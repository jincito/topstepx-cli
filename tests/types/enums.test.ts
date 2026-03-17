import { describe, it, expect } from 'vitest';
import {
  OrderSide,
  OrderType,
  OrderStatus,
  PositionType,
  TimeInForce,
  BarTimeUnit,
  DomType,
  TradeLogType,
  orderSideLabel,
  orderTypeLabel,
  orderStatusLabel,
  positionTypeLabel,
} from '../../src/types/enums.js';

describe('OrderSide', () => {
  it('has correct values matching API documentation', () => {
    expect(OrderSide.Bid).toBe(0);
    expect(OrderSide.Ask).toBe(1);
  });

  it('has exactly 2 keys', () => {
    expect(Object.keys(OrderSide)).toHaveLength(2);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(OrderSide)).toBe(true);
  });
});

describe('OrderType', () => {
  it('has correct values matching API documentation', () => {
    expect(OrderType.Unknown).toBe(0);
    expect(OrderType.Limit).toBe(1);
    expect(OrderType.Market).toBe(2);
    expect(OrderType.StopLimit).toBe(3);
    expect(OrderType.Stop).toBe(4);
    expect(OrderType.TrailingStop).toBe(5);
    expect(OrderType.JoinBid).toBe(6);
    expect(OrderType.JoinAsk).toBe(7);
  });

  it('has exactly 8 keys', () => {
    expect(Object.keys(OrderType)).toHaveLength(8);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(OrderType)).toBe(true);
  });
});

describe('OrderStatus', () => {
  it('has correct values matching API documentation', () => {
    expect(OrderStatus.None).toBe(0);
    expect(OrderStatus.Open).toBe(1);
    expect(OrderStatus.Filled).toBe(2);
    expect(OrderStatus.Cancelled).toBe(3);
    expect(OrderStatus.Expired).toBe(4);
    expect(OrderStatus.Rejected).toBe(5);
    expect(OrderStatus.Pending).toBe(6);
  });

  it('has exactly 7 keys', () => {
    expect(Object.keys(OrderStatus)).toHaveLength(7);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(OrderStatus)).toBe(true);
  });
});

describe('PositionType', () => {
  it('has correct values matching API documentation', () => {
    expect(PositionType.Undefined).toBe(0);
    expect(PositionType.Long).toBe(1);
    expect(PositionType.Short).toBe(2);
  });

  it('has exactly 3 keys', () => {
    expect(Object.keys(PositionType)).toHaveLength(3);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PositionType)).toBe(true);
  });
});

describe('TimeInForce', () => {
  it('has correct values matching API documentation', () => {
    expect(TimeInForce.Day).toBe(0);
    expect(TimeInForce.GTC).toBe(1);
    expect(TimeInForce.GTD).toBe(2);
    expect(TimeInForce.IOC).toBe(3);
    expect(TimeInForce.FOK).toBe(4);
  });

  it('has exactly 5 keys', () => {
    expect(Object.keys(TimeInForce)).toHaveLength(5);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TimeInForce)).toBe(true);
  });
});

describe('BarTimeUnit', () => {
  it('has correct values matching API documentation', () => {
    expect(BarTimeUnit.Second).toBe(1);
    expect(BarTimeUnit.Minute).toBe(2);
    expect(BarTimeUnit.Hour).toBe(3);
    expect(BarTimeUnit.Day).toBe(4);
    expect(BarTimeUnit.Week).toBe(5);
    expect(BarTimeUnit.Month).toBe(6);
  });

  it('has exactly 6 keys', () => {
    expect(Object.keys(BarTimeUnit)).toHaveLength(6);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(BarTimeUnit)).toBe(true);
  });
});

describe('DomType', () => {
  it('has correct values matching API documentation', () => {
    expect(DomType.Unknown).toBe(0);
    expect(DomType.Ask).toBe(1);
    expect(DomType.Bid).toBe(2);
    expect(DomType.BestAsk).toBe(3);
    expect(DomType.BestBid).toBe(4);
    expect(DomType.Trade).toBe(5);
    expect(DomType.Reset).toBe(6);
    expect(DomType.Low).toBe(7);
    expect(DomType.High).toBe(8);
    expect(DomType.NewBestBid).toBe(9);
    expect(DomType.NewBestAsk).toBe(10);
    expect(DomType.Fill).toBe(11);
  });

  it('has exactly 12 keys', () => {
    expect(Object.keys(DomType)).toHaveLength(12);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DomType)).toBe(true);
  });
});

describe('TradeLogType', () => {
  it('has correct values matching API documentation', () => {
    expect(TradeLogType.Buy).toBe(0);
    expect(TradeLogType.Sell).toBe(1);
  });

  it('has exactly 2 keys', () => {
    expect(Object.keys(TradeLogType)).toHaveLength(2);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TradeLogType)).toBe(true);
  });
});

describe('orderSideLabel', () => {
  it('returns BUY for Bid', () => {
    expect(orderSideLabel(OrderSide.Bid)).toBe('BUY');
  });

  it('returns SELL for Ask', () => {
    expect(orderSideLabel(OrderSide.Ask)).toBe('SELL');
  });

  it('returns UNKNOWN for invalid value', () => {
    expect(orderSideLabel(99 as never)).toBe('UNKNOWN');
  });
});

describe('orderTypeLabel', () => {
  it('returns correct labels for all types', () => {
    expect(orderTypeLabel(OrderType.Unknown)).toBe('Unknown');
    expect(orderTypeLabel(OrderType.Limit)).toBe('Limit');
    expect(orderTypeLabel(OrderType.Market)).toBe('Market');
    expect(orderTypeLabel(OrderType.StopLimit)).toBe('StopLimit');
    expect(orderTypeLabel(OrderType.Stop)).toBe('Stop');
    expect(orderTypeLabel(OrderType.TrailingStop)).toBe('TrailingStop');
    expect(orderTypeLabel(OrderType.JoinBid)).toBe('JoinBid');
    expect(orderTypeLabel(OrderType.JoinAsk)).toBe('JoinAsk');
  });

  it('returns Unknown for invalid value', () => {
    expect(orderTypeLabel(99 as never)).toBe('Unknown');
  });
});

describe('orderStatusLabel', () => {
  it('returns None for OrderStatus.None', () => {
    expect(orderStatusLabel(OrderStatus.None)).toBe('None');
  });

  it('returns Open for OrderStatus.Open', () => {
    expect(orderStatusLabel(OrderStatus.Open)).toBe('Open');
  });

  it('returns Filled for OrderStatus.Filled', () => {
    expect(orderStatusLabel(OrderStatus.Filled)).toBe('Filled');
  });

  it('returns Cancelled for OrderStatus.Cancelled', () => {
    expect(orderStatusLabel(OrderStatus.Cancelled)).toBe('Cancelled');
  });

  it('returns Expired for OrderStatus.Expired', () => {
    expect(orderStatusLabel(OrderStatus.Expired)).toBe('Expired');
  });

  it('returns Rejected for OrderStatus.Rejected', () => {
    expect(orderStatusLabel(OrderStatus.Rejected)).toBe('Rejected');
  });

  it('returns Pending for OrderStatus.Pending', () => {
    expect(orderStatusLabel(OrderStatus.Pending)).toBe('Pending');
  });

  it('returns Unknown for invalid value', () => {
    expect(orderStatusLabel(99 as never)).toBe('Unknown');
  });
});

describe('positionTypeLabel', () => {
  it('returns Undefined for PositionType.Undefined', () => {
    expect(positionTypeLabel(PositionType.Undefined)).toBe('Undefined');
  });

  it('returns Long for PositionType.Long', () => {
    expect(positionTypeLabel(PositionType.Long)).toBe('Long');
  });

  it('returns Short for PositionType.Short', () => {
    expect(positionTypeLabel(PositionType.Short)).toBe('Short');
  });

  it('returns Unknown for invalid value', () => {
    expect(positionTypeLabel(99 as never)).toBe('Unknown');
  });
});
