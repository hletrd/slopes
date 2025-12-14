<?php
header('Content-Type: application/json');

$secretsFile = __DIR__ . '/secrets.json';
if (!file_exists($secretsFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server configuration error']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

$ip = $_SERVER['REMOTE_ADDR'];
$limitFile = sys_get_temp_dir() . '/rate_limit_' . md5($ip);
$currentUserTime = time();
$lastRequestTime = file_exists($limitFile) ? (int)file_get_contents($limitFile) : 0;

if ($currentUserTime - $lastRequestTime < 60) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Too many requests. Please try again later.']);
    exit;
}
file_put_contents($limitFile, $currentUserTime);

$secrets = json_decode(file_get_contents($secretsFile), true);
$recaptchaSecret = $secrets['recaptcha_secret'] ?? '';
$githubAppId = $secrets['github_app_id'] ?? '';
$githubAppPrivateKeyPath = $secrets['github_app_private_key_path'] ?? '';
$githubAppInstallationId = $secrets['github_app_installation_id'] ?? '';

if (empty($recaptchaSecret) || empty($githubAppId) || empty($githubAppPrivateKeyPath) || empty($githubAppInstallationId)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server configuration missing']);
    exit;
}

$privateKeyFile = __DIR__ . '/' . $githubAppPrivateKeyPath;
if (!file_exists($privateKeyFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Private key file not found']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$recaptchaResponse = $input['recaptchaResponse'] ?? '';
$type = $input['type'] ?? '';
$title = $input['title'] ?? '';
$content = $input['content'] ?? '';

if (empty($recaptchaResponse) || empty($content) || empty($title)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

if (mb_strlen($content) > 1000) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Content exceeds 1000 characters']);
    exit;
}
if (mb_strlen($title) > 100) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Title exceeds 100 characters']);
    exit;
}

$content = strip_tags($content);
$content = htmlspecialchars($content, ENT_QUOTES, 'UTF-8');
$title = strip_tags($title);
$title = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');

$verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
$data = [
    'secret' => $recaptchaSecret,
    'response' => $recaptchaResponse
];

$options = [
    'http' => [
        'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
        'method'  => 'POST',
        'content' => http_build_query($data)
    ]
];

$context  = stream_context_create($options);
$verifyResult = file_get_contents($verifyUrl, false, $context);
$verifyJson = json_decode($verifyResult, true);

if (!$verifyJson['success']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Recaptcha verification failed']);
    exit;
}

$score = $verifyJson['score'] ?? 0;
$action = $verifyJson['action'] ?? '';

if ($action !== 'submit' || $score < 0.5) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Recaptcha score too low']);
    exit;
}

$category = match ($type) {
    'bug' => 'Bug',
    'feature' => 'Feature',
    default => 'Other',
};

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

$privateKey = file_get_contents($privateKeyFile);
$now = time();
$payload = [
    'iat' => $now - 60,
    'exp' => $now + (10 * 60),
    'iss' => $githubAppId
];

$header = base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
$payloadEncoded = base64url_encode(json_encode($payload));
$dataToSign = $header . '.' . $payloadEncoded;

openssl_sign($dataToSign, $signature, $privateKey, OPENSSL_ALGO_SHA256);
$jwt = $dataToSign . '.' . base64url_encode($signature);

$installationTokenUrl = "https://api.github.com/app/installations/{$githubAppInstallationId}/access_tokens";
$tokenOptions = [
    'http' => [
        'header'  => [
            "Accept: application/vnd.github+json",
            "Authorization: Bearer {$jwt}",
            "User-Agent: SlopesCam-App",
            "X-GitHub-Api-Version: 2022-11-28"
        ],
        'method'  => 'POST'
    ]
];

$tokenContext = stream_context_create($tokenOptions);
$tokenResult = @file_get_contents($installationTokenUrl, false, $tokenContext);

if ($tokenResult === FALSE) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to get installation token']);
    exit;
}

$tokenData = json_decode($tokenResult, true);
$installationToken = $tokenData['token'] ?? '';

if (empty($installationToken)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Invalid installation token']);
    exit;
}

$repoOwner = 'hletrd';
$repoName = 'slopes';
$githubUrl = "https://api.github.com/repos/{$repoOwner}/{$repoName}/issues";

$issueData = [
    'title' => "[{$category}] {$title}",
    'body' => $content . "\n\n_Reported via Slopes cam_"
];

$githubOptions = [
    'http' => [
        'header'  => [
            "Accept: application/vnd.github+json",
            "Authorization: Bearer {$installationToken}",
            "User-Agent: SlopesCam-App",
            "X-GitHub-Api-Version: 2022-11-28",
            "Content-Type: application/json"
        ],
        'method'  => 'POST',
        'content' => json_encode($issueData)
    ]
];

$githubContext = stream_context_create($githubOptions);
$githubResult = @file_get_contents($githubUrl, false, $githubContext);

if ($githubResult === FALSE) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to create GitHub Issue']);
    exit;
}

echo json_encode(['success' => true]);
