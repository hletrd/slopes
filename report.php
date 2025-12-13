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

// Rate Limiting: 1 request per 60 seconds per IP
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
$githubToken = $secrets['github_token'] ?? '';

if (empty($recaptchaSecret) || empty($githubToken)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server configuration missing']);
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

// Enforce max length
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

// Enforce plain text
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

$category = match ($type) {
    'bug' => 'Bug',
    'feature' => 'Feature',
    default => 'Other',
};

// Create GitHub Issue
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
            "Content-type: application/json",
            "Authorization: token {$githubToken}",
            "User-Agent: SlopesCam-App" // GitHub request needs User-Agent
        ],
        'method'  => 'POST',
        'content' => json_encode($issueData)
    ]
];

$githubContext  = stream_context_create($githubOptions);
$githubResult = @file_get_contents($githubUrl, false, $githubContext);

if ($githubResult === FALSE) {
    // Get headers to confirm restriction
    // $responseHeaders = $http_response_header;
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to create GitHub Issue']);
    exit;
}

echo json_encode(['success' => true]);
