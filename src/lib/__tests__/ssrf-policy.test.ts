import { describe, it, expect } from 'vitest';
import { isPrivateIp } from '../ssrf-policy';

describe('isPrivateIp', () => {
  it('should block localhost aliases', () => {
    expect(isPrivateIp('localhost')).toBe(true);
    expect(isPrivateIp('0.0.0.0')).toBe(true);
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('[::1]')).toBe(true);
    expect(isPrivateIp('LOCALHOST')).toBe(true);
  });

  it('should block IPv4 private ranges', () => {
    // 10.0.0.0/8
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.255.255.255')).toBe(true);

    // 127.0.0.0/8 (loopback)
    expect(isPrivateIp('127.0.0.2')).toBe(true);
    expect(isPrivateIp('127.255.255.255')).toBe(true);

    // 0.0.0.0/8 (this network)
    expect(isPrivateIp('0.0.0.1')).toBe(true);
    expect(isPrivateIp('0.255.255.255')).toBe(true);

    // 172.16.0.0/12
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);

    // 192.168.0.0/16
    expect(isPrivateIp('192.168.0.1')).toBe(true);
    expect(isPrivateIp('192.168.255.255')).toBe(true);

    // 169.254.0.0/16 (link-local)
    expect(isPrivateIp('169.254.0.1')).toBe(true);
    expect(isPrivateIp('169.254.255.255')).toBe(true);
  });

  it('should allow public IP addresses', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('104.21.2.1')).toBe(false);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
    expect(isPrivateIp('192.169.0.1')).toBe(false);
  });

  it('should allow non-IP hostnames', () => {
    expect(isPrivateIp('example.com')).toBe(false);
    expect(isPrivateIp('google.com')).toBe(false);
    expect(isPrivateIp('api.github.com')).toBe(false);
  });

  it('should reject invalid IP formats', () => {
    expect(isPrivateIp('10.0.0')).toBe(false);
    expect(isPrivateIp('192.168.1.1.1')).toBe(false);
    expect(isPrivateIp('not.an.ip.address')).toBe(false);
  });
});
