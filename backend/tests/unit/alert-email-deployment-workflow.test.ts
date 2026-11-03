import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const workflow = readFileSync(
  path.join(__dirname, '../../../.github/workflows/deploy.yml'),
  'utf8',
);
const steps = workflow
  .split('\n      - name: ')
  .slice(1)
  .map((block) => {
    const [name, ...lines] = block.split('\n');
    return { name: name.trim(), body: lines.join('\n') };
  });

function body(name: string): string {
  const step = steps.find((value) => value.name === name);
  expect(step).toBeDefined();
  return step?.body ?? '';
}

function expectSequence(names: string[]): void {
  const positions = names.map((name) => steps.findIndex((step) => step.name === name));
  for (const position of positions) expect(position).toBeGreaterThanOrEqual(0);
  for (let index = 1; index < positions.length; index += 1) {
    expect(positions[index]).toBeGreaterThan(positions[index - 1]);
  }
}

describe('production notification activation registry cutover', () => {
  it('installs the CI-verified artifact and stages dependencies before starting downtime', () => {
    expect(workflow).toContain('needs: [detect, backend_ci]');
    expect(workflow).toContain("needs.backend_ci.result == 'success'");
    expectSequence([
      'Build backend once',
      'Test backend once',
      'Upload verified backend',
      'Download verified backend',
      'Verify and stage the backend artifact',
      'Prepare Windows runtime dependencies',
      'Prepare backend release',
      'Stop backend before migrations',
    ]);
    const prepare = body('Prepare backend release');
    expect(body('Prepare Windows runtime dependencies')).toContain('npm ci --omit=dev');
    expect(body('Verify and stage the backend artifact')).toContain('verify --release $artifact');
    expect(prepare).not.toContain('npm ci');
    expect(prepare).toContain('robocopy ".\\backend\\dist"');
    expect(prepare).not.toContain('Stop-Service');
  });

  it('blocks old config writers before backfill and resumes only after installing new hooks', () => {
    expectSequence([
      'Stop backend before migrations',
      'Run backend database migrations',
      'Verify factory profile activation prerequisites',
      'Deploy backend service files',
      'Restart backend and verify health',
    ]);
    const stop = body('Stop backend before migrations');
    expect(stop).toContain('Stop-Service -Name $env:BACKEND_SERVICE -Force');
    expect(stop).toContain("WaitForStatus('Stopped', '00:00:30')");
    expect(body('Deploy backend service files')).not.toContain('npm ci');
  });

  it('retains the dependency-install decision across the separate workflow steps', () => {
    const prepare = body('Prepare backend release');
    expect(prepare).toContain('id: backend_release');
    expect(prepare).toContain('install_production_deps=');
    expect(prepare).toContain('$env:GITHUB_OUTPUT');
    expect(body('Deploy backend service files')).toContain(
      "steps.backend_release.outputs.install_production_deps }}\" -eq 'true'",
    );
  });

  it('does not stop or migrate for frontend-only and documentation-only releases', () => {
    for (const name of [
      'Prepare backend release',
      'Stop backend before migrations',
      'Run backend database migrations',
      'Deploy backend service files',
      'Restart backend and verify health',
    ]) {
      expect(body(name)).toContain("if: needs.detect.outputs.backend_changed == 'true'");
    }
  });

  it('restores the service even when migration or post-migration readiness fails', () => {
    const recovery = body('Ensure backend service is running');
    expect(recovery).toContain("if: always() && needs.detect.outputs.backend_changed == 'true'");
    expect(recovery).toContain("if ($service.Status -ne 'Running')");
    expect(recovery).toContain('Start-Service -Name $env:BACKEND_SERVICE');
    expectSequence([
      'Run backend database migrations',
      'Verify factory profile activation prerequisites',
      'Ensure backend service is running',
    ]);
  });
});
