import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createExceedanceSupervisor } from '../../src/modules/alert-exceedances/exceedance-supervisor';

function child() {
  const instance = Object.assign(new EventEmitter(), {
    connected: true,
    exitCode: null,
    signalCode: null,
    send: jest.fn((message: string, callback: (error: Error | null) => void) => {
      callback(null);
      if (message === 'stop') void Promise.resolve().then(() => instance.emit('exit', 0));
      return true;
    }),
    kill: jest.fn(() => {
      instance.emit('exit', 0);
      return true;
    }),
  });
  return instance;
}
afterEach(() => {
  jest.useRealTimers();
});
describe('existing service detector child process', () => {
  it('does not spawn anything by default', async () => {
    const spawn = jest.fn<() => ChildProcess>();
    const supervisor = createExceedanceSupervisor({ mode: 'off' }, spawn, jest.fn());
    await supervisor.stop();
    expect(spawn).not.toHaveBeenCalled();
  });
  it('stops through IPC before killing a healthy worker and does not restart after shutdown', async () => {
    const instance = child();
    const spawn = jest.fn(() => instance as unknown as ChildProcess);
    const supervisor = createExceedanceSupervisor({ mode: 'active' } as never, spawn, jest.fn());
    await supervisor.stop();
    expect(instance.send).toHaveBeenCalledWith('stop', expect.any(Function));
    expect(instance.kill).not.toHaveBeenCalled();
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it('backs off after an unexpected exit instead of crashing the API or looping immediately', async () => {
    jest.useFakeTimers();
    const first = child(),
      second = child();
    const spawn = jest
      .fn<() => ChildProcess>()
      .mockReturnValueOnce(first as unknown as ChildProcess)
      .mockReturnValue(second as unknown as ChildProcess);
    const report = jest.fn();
    const supervisor = createExceedanceSupervisor({ mode: 'active' } as never, spawn, report);
    first.emit('exit', 1);
    await jest.advanceTimersByTimeAsync(1999);
    expect(spawn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledWith('WORKER_EXITED');
    await supervisor.stop();
  });
});
