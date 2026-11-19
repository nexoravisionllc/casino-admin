import { txRefsFromMemo } from './explorer.js';
import { dbDate, num } from './format.js';

/**
 * Database row -> JSON response shapes. Field names and order match the C#
 * DTO records (camelCase). `createdAt` is passed pre-formatted when the row
 * was created in this request (see format.js).
 */

export const PARTNER_COLUMNS =
  'Uid, Name, LoginId, Role, PartnerId, CasinoRate, SlotRate, SportsRate, Balance, Point, Status, CreatedAt, ReferralId';

export const toAgentRow = (p, createdAt = dbDate(p.CreatedAt)) => ({
  uid: num(p.Uid),
  name: p.Name,
  loginId: p.LoginId,
  role: num(p.Role),
  partnerId: num(p.PartnerId),
  casinoRate: num(p.CasinoRate),
  slotRate: num(p.SlotRate),
  sportsRate: num(p.SportsRate),
  balance: num(p.Balance),
  point: num(p.Point),
  status: p.Status,
  createdAt,
  referralId: p.ReferralId ?? null,
});

export const USER_COLUMNS =
  'Uid, Name, LoginId, PartnerId, Balance, Point, DepositAmount, DepositCount, WithdrawAmount, WithdrawCount, ' +
  'Status, CreatedAt, BankName, Email, BankAccount, BankMaster';

export const toUserRow = (u, createdAt = dbDate(u.CreatedAt)) => ({
  uid: num(u.Uid),
  name: u.Name,
  loginId: u.LoginId,
  partnerId: num(u.PartnerId),
  balance: num(u.Balance),
  point: num(u.Point),
  depositAmount: num(u.DepositAmount),
  depositCount: num(u.DepositCount),
  withdrawAmount: num(u.WithdrawAmount),
  withdrawCount: num(u.WithdrawCount),
  status: u.Status,
  createdAt,
  bankName: u.BankName ?? null,
  email: u.Email ?? null,
  bankAccount: u.BankAccount ?? null,
  bankMaster: u.BankMaster ?? null,
});

export const TRANSACTION_COLUMNS =
  'uid, type, amount, beforeamount, afteramount, status, userid, managerid, memo, created_at, updated_at';

export const toTransactionRow = (r) => ({
  uid: num(r.uid),
  type: r.type,
  amount: num(r.amount),
  beforeAmount: num(r.beforeamount),
  afterAmount: num(r.afteramount),
  status: r.status,
  userId: r.userid,
  managerId: r.managerid ?? null,
  memo: r.memo ?? null,
  txLinks: txRefsFromMemo(r.memo),
  createdAt: dbDate(r.created_at),
  updatedAt: dbDate(r.updated_at),
});

export const PROVIDER_COLUMNS = 'uid, provider_id, name, company, status, image_url, created_at';

export const toProviderRow = (r) => ({
  uid: num(r.uid),
  providerId: num(r.provider_id),
  name: r.name,
  company: r.company,
  status: num(r.status),
  imageUrl: r.image_url ?? null,
  createdAt: dbDate(r.created_at),
});
