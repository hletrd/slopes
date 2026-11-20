const fields = ['temperature', 'humidity', 'wind_speed', 'rainfall', 'snow_cover', 'snowfall_3hr'];

export function weatherValue(field, value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || [-99, -99.9, -999, -9999].includes(number)) return null;
  if (field === 'temperature') return number >= -90 && number <= 60 ? number : null;
  return number < 0 || field === 'humidity' && number > 100 ? null : number;
}

export function latestWeather(location, now = Date.now()) {
  let latest = null;
  for (const row of location?.data || []) {
    const time = Date.parse(row.time);
    if (!Number.isFinite(time) || time > now) continue;
    const clean = { ...row, ...Object.fromEntries(fields.map(field => [field, weatherValue(field, row[field])])) };
    if (fields.every(field => clean[field] === null)) continue;
    if (!latest || time > Date.parse(latest.time)) latest = clean;
  }
  return latest;
}

export function isWeatherStale(point, now = Date.now()) {
  return now - Date.parse(point.time) > 2 * 60 * 60 * 1000;
}

export function weatherTimeParts(time) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(time)).map(({ type, value }) => [type, value]));
  return { month: parts.month, day: parts.day, hours: parts.hour, minutes: parts.minute };
}

export function forecastLocations(grid, now = Date.now()) {
  if (!Array.isArray(grid?.weathers)) return [];
  return grid.weathers.flatMap(location => {
    const data = (location.forecasts || []).flatMap(row => {
      const time = typeof row.timestamp === 'number' ? row.timestamp * 1000 : Date.parse(row.timestamp);
      const temperature = weatherValue('temperature', row.temp);
      if (!Number.isFinite(time) || time <= now || time > now + 120 * 3600000 || temperature === null) return [];
      return [{ time: new Date(time).toISOString(), temperature,
        wind_speed: weatherValue('wind_speed', row.wind_speed),
        snowfall_3hr: weatherValue('snowfall_3hr', row.snow_3h ?? 0) }];
    }).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    return data.length ? [{ resort: location.resort, name: location.name, data, update_time: grid.last_fetch_time }] : [];
  });
}
