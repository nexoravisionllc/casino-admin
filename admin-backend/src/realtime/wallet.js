import { Hub } from './signalr.js';

export const WALLET_HUB_PATH = '/hubs/wallet';

/**
 * Real-time balance/point updates. The user front page subscribes to its own
 * login group; admin pages subscribe to the shared "admins" group.
 */
export const walletHub = new Hub({
  // Called by the user front page with its logged-in login id.
  SubscribeUser: (connection, loginId) => walletHub.addToGroup(connection, `user:${loginId ?? ''}`),

  // Called by admin pages so they refresh on any change.
  SubscribeAdmin: (connection) => walletHub.addToGroup(connection, 'admins'),
});

/** Pushes balance/point changes to the connected user and admin pages. */
export const walletNotifier = {
  /** A user's balance/point changed: update that user and all admins. */
  walletChanged(loginId, balance, point) {
    walletHub.sendToGroup(`user:${loginId}`, 'walletUpdated', { balance, point });
    walletHub.sendToGroup('admins', 'usersChanged');
  },

  /**
   * One of a user's deposit/withdraw requests changed status (accepted or
   * rejected): the user's pages re-read their history, admins refresh.
   */
  transactionChanged(loginId, payload) {
    walletHub.sendToGroup(`user:${loginId}`, 'transactionUpdated', payload);
    walletHub.sendToGroup('admins', 'usersChanged');
  },

  /** Something admins should re-read (e.g. a rejected request), no wallet change. */
  adminsChanged() {
    walletHub.sendToGroup('admins', 'usersChanged');
  },
};
