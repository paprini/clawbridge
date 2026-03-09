'use strict';

const { ddosProtection, blockIp, unblockIp, allowIp } = require('../../src/ddos-protection');

function mockReq(ip = '127.0.0.1') {
  return {
    ip,
    socket: { remoteAddress: ip },
    setTimeout: jest.fn(),
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; },
  };
  return res;
}

describe('DDoS Protection', () => {
  afterEach(() => {
    unblockIp('1.2.3.4');
    unblockIp('5.6.7.8');
  });

  test('allows normal requests', () => {
    const req = mockReq('10.0.0.1');
    const res = mockRes();
    const next = jest.fn();

    ddosProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks blocklisted IPs', () => {
    blockIp('1.2.3.4');
    const req = mockReq('1.2.3.4');
    const res = mockRes();
    const next = jest.fn();

    ddosProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('unblock works', () => {
    blockIp('5.6.7.8');
    unblockIp('5.6.7.8');
    const req = mockReq('5.6.7.8');
    const res = mockRes();
    const next = jest.fn();

    ddosProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allowlisted IPs bypass rate limiting', () => {
    allowIp('192.168.1.1');
    const req = mockReq('192.168.1.1');
    const res = mockRes();
    const next = jest.fn();

    // Call many times — should never be rate limited
    for (let i = 0; i < 500; i++) {
      ddosProtection(mockReq('192.168.1.1'), mockRes(), next);
    }
    expect(next).toHaveBeenCalledTimes(500);
  });

  test('sets request timeout for slowloris protection', () => {
    const req = mockReq('10.0.0.99');
    const res = mockRes();
    const next = jest.fn();

    ddosProtection(req, res, next);
    expect(req.setTimeout).toHaveBeenCalledWith(30000, expect.any(Function));
  });
});
