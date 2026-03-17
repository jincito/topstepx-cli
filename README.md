# topstepx-cli

Terminal-first CLI for the TopStepX (ProjectX Gateway) trading API.

## Features

- **Account Management** -- List and inspect trading accounts
- **Market Data** -- Search contracts, fetch quotes, retrieve historical bars
- **Order Placement** -- Buy and sell with market, limit, stop, stop-limit, and bracket orders
- **Order Management** -- List, modify, and cancel orders
- **Position Management** -- View, flatten, and trim positions
- **Trade History** -- Query past fills with date and symbol filters
- **Real-Time Streaming** -- Live quotes, depth-of-book, and time-and-sales
- **Account Monitoring** -- Stream order fills, position changes, and trade events

## Install

```bash
$ npm install -g topstepx-cli
```

Requires Node.js >= 20.

## Quick Start

```bash
# 1. Install
$ npm install -g topstepx-cli

# 2. Authenticate
$ topstep login

# 3. View your accounts
$ topstep accounts
```

## Authentication

Log in with your TopStepX username and API key:

```bash
$ topstep login
```

Verify your session:

```bash
$ topstep status
```

Clear stored credentials:

```bash
$ topstep logout
```

Credentials are stored in the OS keychain when available, with an encrypted file fallback for headless environments.

## Commands

### Account Management

List all active trading accounts:

```bash
$ topstep accounts
```

View account details (balance, P&L, daily loss limit):

```bash
$ topstep account 12345
```

Select a specific account for any command with the `--account` global flag:

```bash
$ topstep positions --account 12345
```

### Market Data

Search for contracts by keyword:

```bash
$ topstep contracts ES
```

View contract details:

```bash
$ topstep contract CON.F.US.EP.H26
```

Fetch a one-shot quote:

```bash
$ topstep quotes ES
```

Retrieve historical bars:

```bash
# Last 50 five-minute bars
$ topstep bars ES --interval 5m --count 50

# Date range query
$ topstep bars NQ --interval 1h --from 2025-01-01 --to 2025-01-31

# Daily bars
$ topstep bars ES --interval 1d --count 20
```

### Order Placement

Place a market buy order:

```bash
$ topstep buy ES 1
```

Place a limit sell order:

```bash
$ topstep sell ES 1 --limit 5500.00
```

Place a stop order:

```bash
$ topstep buy ES 1 --stop 5400.00
```

Place a stop-limit order:

```bash
$ topstep buy ES 1 --stop-limit 5400 5395
```

Attach a bracket (stop-loss and take-profit):

```bash
$ topstep buy ES 1 --bracket 10 20
```

Skip the confirmation prompt:

```bash
$ topstep buy ES 1 --yes
```

Tag an order for tracking:

```bash
$ topstep sell NQ 2 --limit 19800 --tag "mean-reversion"
```

### Order Management

List open/working orders:

```bash
$ topstep orders
```

Include filled and cancelled orders:

```bash
$ topstep orders --all
```

Filter by symbol:

```bash
$ topstep orders --symbol ES
```

Modify a working order:

```bash
$ topstep modify abc123 --limit 5510.00
```

Cancel a single order:

```bash
$ topstep cancel abc123
```

Cancel all working orders:

```bash
$ topstep cancel-all
```

### Position Management

View open positions:

```bash
$ topstep positions
```

Flatten (close) a position:

```bash
$ topstep flatten ES
```

Flatten all positions:

```bash
$ topstep flatten
```

Partially close a position:

```bash
$ topstep trim ES 1
```

### Trade History

View recent trades:

```bash
$ topstep trades
```

Filter by date range and symbol:

```bash
$ topstep trades --from 2025-01-01 --to 2025-01-31 --symbol ES --limit 100
```

### Streaming

Stream live quotes with in-place updates:

```bash
$ topstep watch ES
```

Include depth-of-book (DOM):

```bash
$ topstep watch ES --depth
```

Include time-and-sales:

```bash
$ topstep watch ES --trades
```

Monitor account events (order fills, position changes, trade executions):

```bash
$ topstep monitor
```

Filter to specific event types:

```bash
$ topstep monitor --orders-only
$ topstep monitor --positions-only
$ topstep monitor --trades-only
```

Press Ctrl+C to exit any streaming command.

## Global Flags

| Flag              | Description                                    |
| ----------------- | ---------------------------------------------- |
| `--json`          | Output as JSON instead of a formatted table    |
| `--no-color`      | Disable colored output (also respects NO_COLOR)|
| `--verbose`       | Show API request/response details on stderr    |
| `--account <id>`  | Use a specific trading account                 |

## Symbol Resolution

Friendly symbols like `ES`, `NQ`, `MES`, `CL`, and `GC` are automatically resolved to full contract IDs. You can use either form:

```bash
# These are equivalent
$ topstep quotes ES
$ topstep quotes CON.F.US.EP.H26
```

The resolver maintains a disk-persisted cache with a 24-hour TTL to minimize API lookups.

## Scripting and Piping

Use `--json` for machine-readable output in scripts:

```bash
# Get account balance as JSON
$ topstep accounts --json

# Extract specific fields with jq
$ topstep accounts --json | jq '.[0].balance'

# Check position size
$ topstep positions --json | jq '.[] | select(.contractId | contains("ES")) | .qty'

# Place an order without confirmation
$ topstep buy ES 1 --limit 5450 --yes --json
```

## License

MIT
