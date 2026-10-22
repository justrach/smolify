import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import { performance } from 'node:perf_hooks';

const provider = process.env.BENCHMARK_PROVIDER;
if (!['github', 'codegraff', 'codegraff-snapshot'].includes(provider)) throw Error('Set BENCHMARK_PROVIDER');
const repetitions = Number(process.env.BENCHMARK_REPEATS || 3);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 5) throw Error('Invalid repeat count');
const optionalRead = async path => readFile(path, 'utf8').then(x => x.trim()).catch(() => null);
const result = {
  provider, sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  startedAt: new Date().toISOString(), node: process.version,
  npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
  hardware: { cpuModel: os.cpus()[0]?.model, visibleCpus: os.cpus().length, memoryBytes: os.totalmem(), architecture: os.arch(), kernel: os.release(), cpuQuota: await optionalRead('/sys/fs/cgroup/cpu.max'), memoryLimit: await optionalRead('/sys/fs/cgroup/memory.max'), os: await optionalRead('/etc/os-release') },
  steps: [], state: 'running',
};
const save = () => writeFile('runner-benchmark-results.json', JSON.stringify(result, null, 2));
async function run(name, args, repetition) {
  const start = performance.now();
  console.log(`\n[benchmark] ${name}, sample ${repetition ?? 'setup'}`);
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn('npm', args, { env: { ...process.env, CI: 'true', NEXT_TELEMETRY_DISABLED: '1', WRANGLER_SEND_METRICS: 'false' }, stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => resolve(code ?? 1));
  });
  const entry = { name, repetition, milliseconds: Math.round(performance.now() - start), exitCode };
  result.steps.push(entry); await save(); console.log('[benchmark result]', JSON.stringify(entry));
  if (exitCode !== 0) throw Error(`${name} failed (${exitCode})`);
}
try {
  if (!process.argv.includes('--skip-install')) await run('locked install', ['ci', '--no-audit', '--no-fund']);
  for (let i = 1; i <= repetitions; i++) {
    for (const path of ['.next', '.open-next', 'tsconfig.tsbuildinfo']) await rm(path, { recursive: true, force: true });
    // OpenNext generates Next's route declarations; measure the explicit checker after that.
    await run('OpenNext build', ['run', 'cf:build'], i);
    await run('TypeScript check', ['run', 'typecheck', '--', '--incremental', 'false'], i);
    await run('unit tests', ['test', '--', '--maxWorkers=2'], i);
  }
  result.state = 'passed';
} catch (error) { result.state = 'failed'; result.error = error.message; process.exitCode = 1; }
finally { result.finishedAt = new Date().toISOString(); await save(); }
