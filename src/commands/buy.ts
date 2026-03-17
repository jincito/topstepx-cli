import { Command } from 'commander';
import confirm from '@inquirer/confirm';
import { loadToken } from '../auth/token.js';
import { resolveSymbol } from '../services/symbol-resolver.js';
import { resolveAccountId } from '../services/account-resolver.js';
import { placeOrder } from '../api/orders.js';
import {
  determineOrderType,
  buildBrackets,
  validateQuantity,
  formatConfirmMessage,
} from '../services/order-builder.js';
import { OrderSide, orderSideLabel, orderTypeLabel } from '../types/enums.js';
import type { OrderSideValue } from '../types/enums.js';
import { output } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/auth-error.js';
import { ValidationError } from '../errors/validation-error.js';

// ─── Output Columns ────────────────────────────────────────────────

const CONFIRM_COLUMNS: ColumnDef[] = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value', align: 'right' },
];

// ─── Shared Order Command Factory ──────────────────────────────────

/**
 * Factory that produces a Commander command for order placement.
 * Both buy and sell commands are generated from this factory,
 * differing only in the OrderSide constant.
 *
 * SAF-01: All enum values use named constants, never bare integers.
 */
export function createOrderCommand(side: OrderSideValue): Command {
  const name = side === OrderSide.Bid ? 'buy' : 'sell';

  return new Command(name)
    .description(`Place a ${name} order`)
    .argument('<symbol>', 'Trading symbol (e.g., ES, NQ, MES)')
    .argument('<qty>', 'Number of contracts')
    .option('--limit <price>', 'Limit price (creates limit order)')
    .option('--stop <price>', 'Stop price (creates stop order)')
    .option('--stop-limit <values...>', 'Stop and limit prices for stop-limit order')
    .option('--bracket <values...>', 'Bracket order: stop-loss ticks and take-profit ticks')
    .option('--tag <string>', 'Custom order tag')
    .option('--yes', 'Skip confirmation prompt')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep ${name} ES 1                       Market ${name} 1 E-mini S&P
  $ topstep ${name} ES 1 --limit 5500          Limit ${name} at 5500
  $ topstep ${name} ES 1 --stop 5400           Stop ${name} at 5400
  $ topstep ${name} ES 1 --stop-limit 5400 5395 Stop-limit ${name}
  $ topstep ${name} ES 1 --bracket 10 20       Market ${name} with bracket
  $ topstep ${name} ES 1 --tag myorder         ${name} with custom tag
  $ topstep ${name} ES 1 --yes                 Skip confirmation prompt
`,
    )
    .action(async (symbol: string, qty: string, opts, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions & { account?: string };

      // 1. Auth check
      const cached = loadToken();
      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // 2. Resolve symbol to contractId
      const contractId = await resolveSymbol(symbol, cached.token);

      // 3. Resolve account
      const accountId = await resolveAccountId(globals, cached.token);

      // 4. Validate quantity
      const size = validateQuantity(qty);

      // 5. Determine order type from flags
      const { type, limitPrice, stopPrice } = determineOrderType(opts);

      // 6. Build bracket objects
      const { stopLossBracket, takeProfitBracket } = buildBrackets(opts.bracket);

      // 7. Extract bracket tick values for confirmation message
      const bracketStop = stopLossBracket ? stopLossBracket.ticks : null;
      const bracketProfit = takeProfitBracket ? takeProfitBracket.ticks : null;

      // 8. Build confirmation message
      const message = formatConfirmMessage(
        side, size, symbol, type, limitPrice, stopPrice, bracketStop, bracketProfit,
      );

      // 9. Confirm order
      if (!opts.yes) {
        if (!process.stdin.isTTY) {
          throw new ValidationError(
            'Order requires confirmation. Use --yes to skip in non-interactive mode.',
            { field: 'confirm' },
          );
        }
        const confirmed = await confirm({ message, default: false });
        if (!confirmed) {
          process.stderr.write('Order cancelled.\n');
          return;
        }
      }

      // 10. Build request with named enum constants (SAF-01)
      const request = {
        accountId,
        contractId,
        type,
        side,
        size,
        limitPrice,
        stopPrice,
        trailPrice: null,
        customTag: opts.tag ?? null,
        stopLossBracket,
        takeProfitBracket,
      };

      // 11. Place order
      const response = await placeOrder(cached.token, request);

      // 12. Display confirmation as field/value detail rows
      const rows: Record<string, unknown>[] = [
        { field: 'Order ID', value: response.orderId },
        { field: 'Side', value: orderSideLabel(side) },
        { field: 'Type', value: orderTypeLabel(type) },
        { field: 'Symbol', value: symbol },
        { field: 'Quantity', value: size },
      ];

      // Conditionally add extra details
      if (limitPrice !== null) {
        rows.push({ field: 'Limit Price', value: limitPrice });
      }
      if (stopPrice !== null) {
        rows.push({ field: 'Stop Price', value: stopPrice });
      }
      if (opts.tag) {
        rows.push({ field: 'Tag', value: opts.tag });
      }
      if (stopLossBracket) {
        rows.push({ field: 'Stop Loss', value: `${stopLossBracket.ticks} ticks` });
      }
      if (takeProfitBracket) {
        rows.push({ field: 'Take Profit', value: `${takeProfitBracket.ticks} ticks` });
      }

      output(rows, CONFIRM_COLUMNS, globals);
    });
}

// ─── Buy Command ───────────────────────────────────────────────────

/** Create a fresh buy Command instance. */
export function createBuyCommand(): Command {
  return createOrderCommand(OrderSide.Bid);
}

/** Default buy command instance for CLI registration. */
export const buyCommand = createBuyCommand();
