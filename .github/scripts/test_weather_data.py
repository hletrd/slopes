import importlib.util
from datetime import datetime, timedelta
from pathlib import Path
import json
import os
import tempfile
import unittest
from unittest.mock import Mock, patch

import pytz

spec = importlib.util.spec_from_file_location('weather', Path(__file__).with_name('fetch_weather_data.py'))
weather = importlib.util.module_from_spec(spec)
spec.loader.exec_module(weather)
NOW = pytz.timezone('Asia/Seoul').localize(datetime(2026, 11, 21, 4, 40))


class WeatherParsingTests(unittest.TestCase):
    def test_headers_and_trailing_all_missing_rows_do_not_replace_observations(self):
        content = '''#START7777
# TM,TA,HM,WS,RN,SD,SD3
202611210410,-3.5,48.4,0.1,0,-999,-999
202611210420,-999,-999,-999,-999,-999,-999
TM,-999,-999,-999,-999,-999,-999
#7777END'''
        rows = weather.parse_kma_weather(content, NOW)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['time'], '2026-11-21T04:10:00+09:00')
        self.assertEqual(rows[0]['temperature'], -3.5)
        self.assertEqual(rows[0]['rainfall'], 0)
        self.assertIsNone(rows[0]['snowfall_3hr'])

    def test_invalid_dates_future_dates_and_nonfinite_values_are_rejected(self):
        content = '''#START7777
202602300400,1,50,1,0,0,0
202611210500,1,50,1,0,0,0
202611210400,NaN,Infinity,-1,-99,-9999,-99.9
#7777END'''
        self.assertEqual(weather.parse_kma_weather(content, NOW), [])

    def test_records_are_sorted_and_zero_is_valid(self):
        rows = weather.parse_kma_weather('''#START7777
202611210420,0,0,0,0,0,0
202611210410,-5,50,1,0,-999,-999
#7777END''', NOW)
        self.assertEqual([r['temperature'] for r in rows], [-5, 0])
        self.assertEqual(rows[-1]['snow_cover'], 0)

    def test_request_uses_five_minute_samples_within_a_one_hour_window(self):
        response = Mock(status_code=200, text='#START7777\n202611210410,-3,50,1,0,-999,-999\n#7777END')
        with patch.object(weather.requests, 'get', return_value=response) as get:
            result = weather.fetch_weather_data_for_location(37, 127, 'Base', 'Resort', 'test-key')
        params = get.call_args.kwargs['params']
        start = datetime.strptime(params['tm1'], '%Y%m%d%H%M')
        end = datetime.strptime(params['tm2'], '%Y%m%d%H%M')
        self.assertEqual(end - start, timedelta(hours=1))
        self.assertEqual(params['itv'], 5)
        self.assertEqual(end.minute % 5, 0)
        self.assertIsNotNone(result)

    def test_all_missing_response_keeps_previous_valid_data_instead_of_success(self):
        response = Mock(status_code=200, text='#START7777\n202611210410,-999,-999,-999,-999,-999,-999\n#7777END')
        with patch.object(weather.requests, 'get', return_value=response):
            self.assertIsNone(weather.fetch_weather_data_for_location(37, 127, 'Base', 'Resort', 'test-key'))

    def test_legacy_cache_is_cleaned_without_changing_observation_time(self):
        rows = weather.clean_weather_rows([
            {'time': '2026-11-21T04:10:00+09:00', 'temperature': -3, 'humidity': -999},
            {'time': 'TM--T::00+09:00', 'temperature': -999},
        ], NOW)
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]['humidity'])
        self.assertEqual(rows[0]['time'], '2026-11-21T04:10:00+09:00')

    def test_forecast_refresh_is_not_limited_to_a_particular_clock_minute(self):
        now = datetime.now(pytz.timezone('Asia/Seoul'))
        response = Mock(status_code=200)
        response.json.return_value = {'list': [
            {'dt': now.timestamp() + 3600, 'main': {'temp': 0}, 'snow': {'3h': 2.5}},
            {'dt': now.timestamp() - 3600, 'main': {'temp': 10}},
        ]}
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {'OPENWEATHER_API_KEY': 'test-key'}):
            previous_dir = os.getcwd()
            try:
                os.chdir(root)
                with patch.object(weather.requests, 'get', return_value=response) as get:
                    weather.fetch_forecast_openweather([{'name': 'Resort', 'coordinates': [{'name': 'Base', 'latitude': 37, 'longitude': 127}]}])
                data = json.loads(Path('weather.grid.json').read_text())
                self.assertEqual(len(data['weathers'][0]['forecasts']), 1)
                self.assertEqual(data['weathers'][0]['forecasts'][0]['temp'], 0)
                self.assertEqual(data['weathers'][0]['forecasts'][0]['snow_3h'], 2.5)
                self.assertEqual(get.call_args.kwargs['params']['units'], 'metric')
            finally:
                os.chdir(previous_dir)

    def test_recent_forecasts_are_reused_without_api_requests(self):
        now = datetime.now(pytz.timezone('Asia/Seoul'))
        data = {'last_fetch_time': now.isoformat(), 'weathers': [{'forecasts': [{'timestamp': now.timestamp() + 3600}]}]}
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {'OPENWEATHER_API_KEY': 'test-key'}):
            previous_dir = os.getcwd()
            try:
                os.chdir(root)
                Path('weather.grid.json').write_text(json.dumps(data))
                with patch.object(weather.requests, 'get') as get:
                    weather.fetch_forecast_openweather([])
                get.assert_not_called()
            finally:
                os.chdir(previous_dir)


if __name__ == '__main__':
    unittest.main()
