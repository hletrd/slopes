import pathlib
import subprocess
import sys
import tempfile
import unittest


class HttpsConfigTests(unittest.TestCase):
    def test_migration_is_idempotent_and_preserves_other_sites(self):
        source = '''server {
  listen 80;
  server_name ski.atik.kr;
  root /var/www/ski;
  location / { proxy_pass https://hletrd.github.io/slopes/; }
}
server {
  listen 443 ssl;
  server_name ski.atik.kr;
  ssl_certificate /existing/fullchain.pem;
  ssl_certificate_key /existing/privkey.pem;
  include /etc/letsencrypt/options-ssl-nginx.conf;
  return 301 http://$host$request_uri;
}
server { listen 443 ssl; server_name other.example; root /other; }
'''
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'nginx.conf'
            path.write_text(source)
            script = pathlib.Path(__file__).with_name('configure-nginx.py')
            subprocess.run([sys.executable, str(script), str(path)], check=True)
            once = path.read_text()
            self.assertIn('return 301 https://$host$request_uri;', once)
            self.assertNotIn('return 301 http://', once)
            self.assertEqual(once.count('root /var/www/ski;'), 1)
            self.assertIn('ssl_certificate /existing/fullchain.pem;', once)
            self.assertIn('server { listen 443 ssl; server_name other.example; root /other; }', once)
            self.assertEqual(once.count('include /etc/nginx/snippets/slopes-relay.conf;'), 2)
            subprocess.run([sys.executable, str(script), str(path)], check=True)
            self.assertEqual(once, path.read_text())


if __name__ == '__main__':
    unittest.main()
