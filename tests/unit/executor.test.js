'use strict';

const path = require('path');
process.env.A2A_CONFIG_DIR = path.join(__dirname, '..', '..', 'config');

const { OpenClawExecutor } = require('../../src/executor');

describe('OpenClawExecutor', () => {
  let executor;

  beforeEach(() => {
    executor = new OpenClawExecutor();
  });

  function makeContext(text) {
    return {
      userMessage: {
        kind: 'message',
        messageId: 'test-msg',
        role: 'user',
        parts: [{ kind: 'text', text }],
      },
      taskId: 'test-task',
      contextId: 'test-context',
    };
  }

  function makeEventBus() {
    const events = [];
    let finished = false;
    return {
      publish(event) { events.push(event); },
      finished() { finished = true; },
      getEvents() { return events; },
      isFinished() { return finished; },
    };
  }

  test('handles ping skill', async () => {
    const ctx = makeContext('ping');
    const bus = makeEventBus();

    await executor.execute(ctx, bus);

    expect(bus.isFinished()).toBe(true);
    expect(bus.getEvents()).toHaveLength(1);

    const msg = bus.getEvents()[0];
    expect(msg.kind).toBe('message');
    expect(msg.role).toBe('agent');

    const result = JSON.parse(msg.parts[0].text);
    expect(result.status).toBe('pong');
    expect(result).toHaveProperty('timestamp');
  });

  test('handles get_status skill', async () => {
    const ctx = makeContext('get_status');
    const bus = makeEventBus();

    await executor.execute(ctx, bus);

    expect(bus.isFinished()).toBe(true);
    const result = JSON.parse(bus.getEvents()[0].parts[0].text);
    expect(result.agent).toHaveProperty('id');
    expect(result).toHaveProperty('uptime');
    expect(result).toHaveProperty('skills');
    expect(result.skills).toContain('ping');
    expect(result.skills).toContain('get_status');
  });

  test('handles unknown skill gracefully', async () => {
    const ctx = makeContext('hack_the_planet');
    const bus = makeEventBus();

    await executor.execute(ctx, bus);

    expect(bus.isFinished()).toBe(true);
    const result = JSON.parse(bus.getEvents()[0].parts[0].text);
    expect(result).toHaveProperty('error');
  });

  test('handles empty message', async () => {
    const ctx = makeContext('');
    const bus = makeEventBus();

    await executor.execute(ctx, bus);

    expect(bus.isFinished()).toBe(true);
  });

  test('cancelTask finishes immediately', async () => {
    const bus = makeEventBus();
    await executor.cancelTask('test-task', bus);
    expect(bus.isFinished()).toBe(true);
  });
});
