import { Command } from 'commander';
import { OrderSide } from '../types/enums.js';
import { createOrderCommand } from './buy.js';

/** Create a fresh sell Command instance. */
export function createSellCommand(): Command {
  return createOrderCommand(OrderSide.Ask);
}

/** Default sell command instance for CLI registration. */
export const sellCommand = createSellCommand();
