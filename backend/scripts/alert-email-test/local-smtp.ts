import { createServer, type Socket } from 'node:net';

export interface CapturedSmtpMessage {
  from: string;
  recipients: string[];
  data: Buffer;
}

/** A receiving sink only. It has no DNS, relay, outbound connection, authentication or TLS configuration. */
export async function startLocalSmtpSink(): Promise<{
  host: '127.0.0.1';
  port: number;
  messages: CapturedSmtpMessage[];
  close(): Promise<void>;
}> {
  const messages: CapturedSmtpMessage[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.setTimeout(10_000, () => socket.destroy());
    socket.on('error', () => socket.destroy());
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 poms-local-test SMTP capture only\r\n');
    let buffer = '';
    let from: string | null = null;
    let recipients: string[] = [];
    let inData = false;
    let data: string[] = [];
    let dataBytes = 0;
    const reset = () => {
      from = null;
      recipients = [];
      data = [];
      dataBytes = 0;
      inData = false;
    };

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      // Nodemailer uses CRLF. Bound unframed input and the complete DATA body.
      if (Buffer.byteLength(buffer) > 1_048_576) {
        socket.destroy();
        return;
      }
      let end: number;
      while ((end = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === '.') {
            messages.push({
              from: from!,
              recipients: [...recipients],
              data: Buffer.from(`${data.join('\r\n')}\r\n`, 'utf8'),
            });
            const id = messages.length;
            reset();
            socket.write(`250 2.0.0 captured-${id}\r\n`);
          } else {
            const unstuffed = line.startsWith('..') ? line.slice(1) : line;
            dataBytes += Buffer.byteLength(unstuffed) + 2;
            if (dataBytes > 1_048_576) {
              socket.destroy();
              return;
            }
            data.push(unstuffed);
          }
          continue;
        }
        const command = line.split(' ', 1)[0].toUpperCase();
        if (command === 'EHLO') socket.write('250-poms-local-test\r\n250 SIZE 1048576\r\n');
        else if (command === 'HELO' || command === 'NOOP') socket.write('250 OK\r\n');
        else if (command === 'RSET') {
          reset();
          socket.write('250 OK\r\n');
        } else if (command === 'QUIT') {
          socket.end('221 Bye\r\n');
        } else if (command === 'MAIL') {
          const address = /^MAIL FROM:<([^<>\r\n]*)>(?:\s.*)?$/i.exec(line);
          reset();
          if (!address) socket.write('501 Invalid sender\r\n');
          else {
            from = address[1];
            socket.write('250 Sender accepted\r\n');
          }
        } else if (command === 'RCPT') {
          const address = /^RCPT TO:<([^<>\r\n]+)>(?:\s.*)?$/i.exec(line);
          if (from === null || !address) socket.write('503 Sender required\r\n');
          else {
            recipients.push(address[1]);
            socket.write('250 Recipient captured locally\r\n');
          }
        } else if (command === 'DATA') {
          if (from === null || recipients.length === 0) socket.write('503 Envelope required\r\n');
          else {
            inData = true;
            socket.write('354 End with <CRLF>.<CRLF>\r\n');
          }
        } else socket.write('502 Unsupported command\r\n');
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new Error('The local SMTP sink did not receive a loopback port');
  }
  return {
    host: '127.0.0.1',
    port: address.port,
    messages,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
