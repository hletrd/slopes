import copy
import importlib.util
import pathlib
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('scraper', pathlib.Path(__file__).with_name('webcam_scraper.py'))
scraper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scraper)


class SourceRefreshTests(unittest.TestCase):
    def test_phoenix_matches_camera_names_without_reordering(self):
        cameras = [{'name': '호크 / 스패로우', 'video': 'old-a'}, {'name': '베이스', 'video': 'old-b'}]
        response = Mock()
        response.json.return_value = [{'vwLoc': '베이스', 'cctvUrlInfo': 'https://example.test/base.m3u8'},
                                      {'vwLoc': '호크/스패로우', 'cctvUrlInfo': 'https://example.test/hawk.m3u8'}]
        with patch.object(scraper.requests, 'get', return_value=response):
            self.assertTrue(scraper.update_phoenix_links(cameras))
        self.assertEqual([c['video'] for c in cameras], ['https://example.test/hawk.m3u8', 'https://example.test/base.m3u8'])

    def test_live_channel_title_matching_preserves_camera_identity(self):
        camera = {'youtube_channel': 'https://youtube.com/channel/example', 'youtube_title': '山頂', 'video': 'old'}
        with patch.object(scraper, 'youtube_live_entries', return_value=[{'id': 'base', 'title': '山麓'}, {'id': 'summit', 'title': '山頂 LIVE'}]):
            self.assertTrue(scraper.update_youtube_link(camera))
        self.assertEqual(camera['video'], 'https://www.youtube.com/watch?v=summit')
        self.assertEqual(camera['video_type'], 'youtube')

    def test_no_live_feed_does_not_replace_it_with_an_archived_recording(self):
        camera = {'youtube_channel': 'https://youtube.com/channel/example', 'video': 'previous'}
        before = copy.deepcopy(camera)
        with patch.object(scraper, 'youtube_live_entries', return_value=[]):
            self.assertFalse(scraper.update_youtube_link(camera))
        self.assertEqual(camera, before)

    def test_unlisted_player_ids_refresh_from_the_correct_official_player(self):
        camera = {'youtube_page': 'https://resort.test/live', 'youtube_player': 'livecam01', 'video': 'old'}
        response = Mock(text="new YT.Player('livecam02', {videoId: 'wrong000001'}); new YT.Player('livecam01', {videoId: 'correct0001'});")
        with patch.object(scraper.requests, 'get', return_value=response):
            self.assertTrue(scraper.update_youtube_link(camera))
        self.assertEqual(camera['video'], 'https://www.youtube.com/watch?v=correct0001')

    def test_provider_embedding_restrictions_keep_the_external_link(self):
        camera = {'youtube_channel': 'https://youtube.com/channel/example', 'youtube_embed': False}
        with patch.object(scraper, 'youtube_live_entries', return_value=[{'id': 'live', 'title': 'Live'}]):
            scraper.update_youtube_link(camera)
        self.assertEqual(camera['video_type'], 'link')

    def test_known_retired_video_is_not_restored_from_an_outdated_official_page(self):
        camera = {'youtube_page': 'https://resort.test/live', 'youtube_unavailable_id': 'retired0001',
                  'video': 'https://resort.test/live', 'video_type': 'link'}
        response = Mock(text='<iframe src="https://www.youtube.com/embed/retired0001"></iframe>')
        with patch.object(scraper.requests, 'get', return_value=response):
            self.assertFalse(scraper.update_youtube_link(camera))
        self.assertEqual(camera['video_type'], 'link')

    def test_public_widget_redirect_refreshes_without_downloading_video(self):
        camera = {'youtube_page': 'https://widget.test/embed/camera', 'youtube_redirect': True}
        response = Mock(headers={'Location': 'https://www.youtube.com/embed/current0001?autoplay=1'})
        with patch.object(scraper.requests, 'get', return_value=response) as request:
            self.assertTrue(scraper.update_youtube_link(camera))
        self.assertEqual(camera['video'], 'https://www.youtube.com/watch?v=current0001')
        self.assertFalse(request.call_args.kwargs['allow_redirects'])
        self.assertTrue(request.call_args.kwargs['stream'])
        response.close.assert_called_once()


if __name__ == '__main__':
    unittest.main()
