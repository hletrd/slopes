import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestWeather, weatherValue, weatherTimeParts, isWeatherStale, forecastLocations } from '../../weather-data.mjs';

const now = Date.parse('2026-11-21T04:40:00+09:00');
test('legacy header and missing latest rows cannot replace real observations', () => {
  const point = latestWeather({ data: [
    { time: '2026-11-21T04:10:00+09:00', temperature: -3.5, humidity: 50, rainfall: 0, snowfall_3hr: -999 },
    { time: '2026-11-21T04:20:00+09:00', temperature: -999 },
    { time: 'TM--T::00+09:00', temperature: -999 },
  ] }, now);
  assert.equal(point.time, '2026-11-21T04:10:00+09:00');
  assert.equal(point.temperature, -3.5);
  assert.equal(point.rainfall, 0);
  assert.equal(point.snowfall_3hr, null);
});
test('selects newest valid time irrespective of input order and rejects future data', () => {
  const point = latestWeather({ data: [
    { time: '2026-11-21T05:00:00+09:00', temperature: 20 },
    { time: '2026-11-21T04:20:00+09:00', temperature: 0 },
    { time: '2026-11-21T04:10:00+09:00', temperature: -5 },
  ] }, now);
  assert.equal(point.temperature, 0);
  assert.equal(latestWeather(undefined, now), null);
});
test('missing and impossible metrics stay missing while real zero and frost are retained', () => {
  for (const value of [-999, -99, -99.9, -9999, '', null, undefined, true, NaN, Infinity]) {
    assert.equal(weatherValue('temperature', value), null);
  }
  assert.equal(weatherValue('temperature', -5), -5);
  assert.equal(weatherValue('humidity', 101), null);
  assert.equal(weatherValue('rainfall', -1), null);
  assert.equal(weatherValue('wind_speed', 0), 0);
});
test('observation labels use Korean time and flag older data', () => {
  assert.deepEqual(weatherTimeParts('2026-11-20T15:10:00Z'), { month: '11', day: '21', hours: '00', minutes: '10' });
  assert.equal(isWeatherStale({ time: '2026-11-21T04:10:00+09:00' }, now), false);
  assert.equal(isWeatherStale({ time: '2026-11-21T00:10:00+09:00' }, now), true);
});

test('forecast Unix seconds become future dates and zero temperatures remain valid', () => {
  const grid = { last_fetch_time: '2026-11-21T04:30:00+09:00', weathers: [{ resort: 'Resort', name: 'Base', forecasts: [
    { timestamp: (now + 3600000) / 1000, temp: 0, wind_speed: 0, snow_3h: 2.5 },
    { timestamp: (now + 7200000) / 1000, temp: -5, wind_speed: 1 },
  ] }] };
  const rows = forecastLocations(grid, now);
  assert.equal(rows[0].data[0].time, new Date(now + 3600000).toISOString());
  assert.equal(rows[0].data[0].temperature, 0);
  assert.equal(rows[0].data[0].snowfall_3hr, 2.5); // Provider units are mm, not cm.
  assert.equal(rows[0].data[1].snowfall_3hr, 0);
});
test('expired forecasts never render as current forecasts', () => {
  assert.deepEqual(forecastLocations({ weathers: [{ forecasts: [{ timestamp: 1746111600, temp: 12 }] }] }, now), []);
  assert.deepEqual(forecastLocations({}, now), []);
});
