# runner-timeout probe (2026-03-18)

## Conditions
- timeout: 240000ms
- command: `claude -p ... --max-turns 20 --output-format text`
- cwd: `/Users/array0224/stillframe-phase0`

## Results
| test_name | mode | duration_ms | timed_out | exit_code | stdout_bytes | stderr_bytes |
|---|---|---:|:---:|---:|---:|---:|
| short-direct | spawnSync-direct | 24131 | no | 0 | 3 | 0 |
| long-direct | spawnSync-direct | 240335 | yes | 143 | 0 | 0 |
| short-shell | execSync-shell | 14762 | no | 0 | 3 | 0 |
| long-shell | execSync-shell | 240003 | yes |  | 0 | 0 |

## Raw
```json
{
  "test_name": "short-direct",
  "mode": "spawnSync-direct",
  "started_at": "2026-03-18T02:35:24.242Z",
  "ended_at": "2026-03-18T02:35:48.373Z",
  "duration_ms": 24131,
  "exit_code": 0,
  "timed_out": false,
  "signal": null,
  "stdout_bytes": 3,
  "stderr_bytes": 0,
  "error_message": null
}
```
```json
{
  "test_name": "long-direct",
  "mode": "spawnSync-direct",
  "started_at": "2026-03-18T02:35:48.381Z",
  "ended_at": "2026-03-18T02:39:48.716Z",
  "duration_ms": 240335,
  "exit_code": 143,
  "timed_out": true,
  "signal": null,
  "stdout_bytes": 0,
  "stderr_bytes": 0,
  "error_message": "spawnSync claude ETIMEDOUT"
}
```
```json
{
  "test_name": "short-shell",
  "mode": "execSync-shell",
  "started_at": "2026-03-18T02:39:48.717Z",
  "ended_at": "2026-03-18T02:40:03.479Z",
  "duration_ms": 14762,
  "exit_code": 0,
  "timed_out": false,
  "signal": null,
  "stdout_bytes": 3,
  "stderr_bytes": 0,
  "error_message": null
}
```
```json
{
  "test_name": "long-shell",
  "mode": "execSync-shell",
  "started_at": "2026-03-18T02:40:03.479Z",
  "ended_at": "2026-03-18T02:44:03.482Z",
  "duration_ms": 240003,
  "exit_code": null,
  "timed_out": true,
  "signal": "SIGTERM",
  "stdout_bytes": 0,
  "stderr_bytes": 0,
  "error_message": "spawnSync /bin/sh ETIMEDOUT"
}
```
