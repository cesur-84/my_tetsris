const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const linesElement = document.getElementById("lines");
const levelElement = document.getElementById("level");
const bestScoreElement = document.getElementById("best-score");
const overlayElement = document.getElementById("overlay");
const overlayTextElement = document.getElementById("overlay-text");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const endButton = document.getElementById("end-button");
const logoutButton = document.getElementById("logout-button");
const loginForm = document.getElementById("login-form");
const loginEmailInput = document.getElementById("login-email");
const loginPwInput = document.getElementById("login-pw");
const loginButton = document.getElementById("login-button");
const loginMessageElement = document.getElementById("login-message");
const userInfoElement = document.getElementById("user-info");
const userNicknameElement = document.getElementById("user-nickname");
const userIdElement = document.getElementById("user-id");
const authModeButton = document.getElementById("auth-mode-button");
const authTitleElement = document.getElementById("auth-title");
const loginIdLabel = document.getElementById("login-id-label");
const supabaseForm = document.getElementById("supabase-form");
const supabaseUrlInput = document.getElementById("supabase-url");
const supabaseKeyInput = document.getElementById("supabase-key");
const supabaseMessageElement = document.getElementById("supabase-message");

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = canvas.width / COLS;
const EMPTY = 0;
const DROP_INTERVAL_START = 700;
const SUPABASE_URL_KEY = "tetris-supabase-url";
const SUPABASE_PUBLISHABLE_KEY = "tetris-supabase-publishable-key";

const COLORS = {
  1: "#00f0f0",
  2: "#f0f000",
  3: "#a000f0",
  4: "#00f000",
  5: "#f00000",
  6: "#0000f0",
  7: "#f0a000"
};

const SHAPES = [
  [],
  [[1, 1, 1, 1]],
  [
    [2, 2],
    [2, 2]
  ],
  [
    [0, 3, 0],
    [3, 3, 3]
  ],
  [
    [0, 4, 4],
    [4, 4, 0]
  ],
  [
    [5, 5, 0],
    [0, 5, 5]
  ],
  [
    [6, 0, 0],
    [6, 6, 6]
  ],
  [
    [0, 0, 7],
    [7, 7, 7]
  ]
];

let board = createBoard();
let currentPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let bestScore = 0;
let lastTime = 0;
let dropCounter = 0;
let dropInterval = DROP_INTERVAL_START;
let animationId = null;
let gameRunning = false;
let gamePaused = false;
let currentUser = null;
let currentProfile = null;
let supabaseClient = null;
let isSignupMode = false;

loadSupabaseConfigIntoInputs();
initializeSupabaseClient();
draw();
updateStats();
updateButtonState();
updateAuthModeUI();
updateAuthUI();

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
endButton.addEventListener("click", endCurrentGame);
logoutButton.addEventListener("click", logout);
loginForm.addEventListener("submit", handleAuthSubmit);
authModeButton.addEventListener("click", toggleAuthMode);
supabaseForm.addEventListener("submit", saveSupabaseConfig);
document.addEventListener("keydown", handleKeyDown);

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

async function saveSupabaseConfig(event) {
  event.preventDefault();

  const url = supabaseUrlInput.value.trim();
  const key = supabaseKeyInput.value.trim();

  if (!url || !key) {
    setSupabaseMessage("프로젝트 URL과 Publishable 키를 모두 입력해야 합니다.", "error");
    return;
  }

  localStorage.setItem(SUPABASE_URL_KEY, url);
  localStorage.setItem(SUPABASE_PUBLISHABLE_KEY, key);
  setSupabaseMessage("Supabase 정보를 저장했습니다. 연결을 시도합니다.", "success");
  initializeSupabaseClient();
  await restoreSupabaseSession();
}

function loadSupabaseConfigIntoInputs() {
  supabaseUrlInput.value = localStorage.getItem(SUPABASE_URL_KEY) || "";
  supabaseKeyInput.value = localStorage.getItem(SUPABASE_PUBLISHABLE_KEY) || "";
}

function initializeSupabaseClient() {
  const url = localStorage.getItem(SUPABASE_URL_KEY);
  const key = localStorage.getItem(SUPABASE_PUBLISHABLE_KEY);

  if (!url || !key || !window.supabase) {
    supabaseClient = null;
    setSupabaseMessage("먼저 프로젝트 URL과 Publishable 키를 붙여넣으세요.", "");
    showOverlay("먼저 Supabase를 연결하세요");
    updateButtonState();
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(url, key);
    setSupabaseMessage("Supabase 준비 완료.", "success");
  } catch (error) {
    supabaseClient = null;
    setSupabaseMessage("Supabase 연결 설정에 실패했습니다. 복사한 값을 확인하세요.", "error");
    showOverlay("Supabase 설정 오류");
  }

  updateButtonState();
}

async function restoreSupabaseSession() {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) {
    currentUser = null;
    currentProfile = null;
    bestScore = 0;
    updateAuthUI();
    updateStats();
    showOverlay("먼저 로그인하세요");
    return;
  }

  currentUser = data.session.user;
  await loadProfile();
  setLoginMessage("저장된 세션으로 로그인했습니다.", "success");
  updateAuthUI();
  hideOverlay();
}

function startGame() {
  if (!currentUser) {
    setLoginMessage("게임을 시작하기 전에 먼저 로그인하세요.", "error");
    return;
  }

  board = createBoard();
  currentPiece = createPiece();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = DROP_INTERVAL_START;
  dropCounter = 0;
  lastTime = 0;
  gameRunning = true;
  gamePaused = false;
  hideOverlay();
  updateStats();
  updateButtonState();

  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  animationId = requestAnimationFrame(update);
}

function update(time = 0) {
  if (!gameRunning || gamePaused) {
    return;
  }

  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > dropInterval) {
    moveDown();
  }

  draw();
  animationId = requestAnimationFrame(update);
}

function createPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = SHAPES[type].map((row) => [...row]);
  return {
    shape,
    x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
    y: 0
  };
}

function draw() {
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawBoard(board);

  if (currentPiece) {
    drawMatrix(currentPiece.shape, currentPiece.x, currentPiece.y);
  }
}

function drawGrid() {
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.lineWidth = 1;

  for (let x = 0; x <= COLS; x += 1) {
    context.beginPath();
    context.moveTo(x * BLOCK_SIZE, 0);
    context.lineTo(x * BLOCK_SIZE, canvas.height);
    context.stroke();
  }

  for (let y = 0; y <= ROWS; y += 1) {
    context.beginPath();
    context.moveTo(0, y * BLOCK_SIZE);
    context.lineTo(canvas.width, y * BLOCK_SIZE);
    context.stroke();
  }
}

function drawBoard(matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (matrix[y][x] !== EMPTY) {
        drawBlock(x, y, COLORS[matrix[y][x]]);
      }
    }
  }
}

function drawMatrix(matrix, offsetX, offsetY) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      const value = matrix[y][x];
      if (value !== EMPTY) {
        drawBlock(x + offsetX, y + offsetY, COLORS[value]);
      }
    }
  }
}

function drawBlock(x, y, color) {
  context.fillStyle = color;
  context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  context.strokeStyle = "#111";
  context.lineWidth = 2;
  context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  context.fillStyle = "rgba(255,255,255,0.25)";
  context.fillRect(x * BLOCK_SIZE + 3, y * BLOCK_SIZE + 3, BLOCK_SIZE - 6, 5);
}

function handleKeyDown(event) {
  if (event.code === "KeyP") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (!gameRunning || gamePaused) {
    return;
  }

  switch (event.code) {
    case "ArrowLeft":
      event.preventDefault();
      moveHorizontal(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      moveHorizontal(1);
      break;
    case "ArrowDown":
      event.preventDefault();
      moveDown();
      break;
    case "ArrowUp":
      event.preventDefault();
      rotatePiece();
      break;
    case "Space":
      event.preventDefault();
      hardDrop();
      break;
    default:
      break;
  }
}

function moveHorizontal(direction) {
  currentPiece.x += direction;
  if (collides(board, currentPiece)) {
    currentPiece.x -= direction;
  }
}

function moveDown() {
  currentPiece.y += 1;
  if (collides(board, currentPiece)) {
    currentPiece.y -= 1;
    merge(board, currentPiece);
    clearLines();
    currentPiece = createPiece();

    if (collides(board, currentPiece)) {
      endGame();
    }
  }

  dropCounter = 0;
}

function hardDrop() {
  let moved = 0;

  while (!collides(board, currentPiece)) {
    currentPiece.y += 1;
    moved += 1;
  }

  currentPiece.y -= 1;
  moved -= 1;
  score += Math.max(0, moved) * 2;
  moveDown();
  updateStats();
}

function rotatePiece() {
  const originalShape = currentPiece.shape;
  const originalX = currentPiece.x;
  currentPiece.shape = rotateMatrix(originalShape);

  if (collides(board, currentPiece)) {
    currentPiece.x += 1;
  }
  if (collides(board, currentPiece)) {
    currentPiece.x -= 2;
  }
  if (collides(board, currentPiece)) {
    currentPiece.x = originalX;
    currentPiece.shape = originalShape;
  }
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function collides(targetBoard, piece) {
  return piece.shape.some((row, y) =>
    row.some((value, x) => {
      if (value === EMPTY) {
        return false;
      }

      const boardX = x + piece.x;
      const boardY = y + piece.y;

      return (
        boardX < 0 ||
        boardX >= COLS ||
        boardY >= ROWS ||
        (boardY >= 0 && targetBoard[boardY][boardX] !== EMPTY)
      );
    })
  );
}

function merge(targetBoard, piece) {
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== EMPTY) {
        targetBoard[y + piece.y][x + piece.x] = value;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every((cell) => cell !== EMPTY)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(EMPTY));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared === 0) {
    return;
  }

  const lineScores = [0, 100, 300, 500, 800];
  score += lineScores[cleared] * level;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(120, DROP_INTERVAL_START - (level - 1) * 60);
  updateStats();
}

function updateStats() {
  scoreElement.textContent = score;
  linesElement.textContent = lines;
  levelElement.textContent = level;
  bestScoreElement.textContent = bestScore;

  if (currentProfile && score > bestScore) {
    bestScore = score;
    bestScoreElement.textContent = bestScore;
    saveBestScore(bestScore);
  }
}

async function saveBestScore(newBestScore) {
  if (!supabaseClient || !currentUser) {
    return;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({ best_score: newBestScore })
    .eq("id", currentUser.id);

  if (!error && currentProfile) {
    currentProfile.best_score = newBestScore;
  }
}

function endGame() {
  gameRunning = false;
  gamePaused = false;
  cancelAnimationFrame(animationId);
  updateStats();
  updateButtonState();
  showOverlay(`게임 오버\n점수: ${score}\n시작을 누르세요`);
}

function togglePause() {
  if (!gameRunning) {
    return;
  }

  gamePaused = !gamePaused;
  updateButtonState();

  if (gamePaused) {
    cancelAnimationFrame(animationId);
    showOverlay("일시정지");
    return;
  }

  hideOverlay();
  lastTime = 0;
  dropCounter = 0;
  animationId = requestAnimationFrame(update);
}

function endCurrentGame() {
  if (!gameRunning && !gamePaused) {
    return;
  }

  gameRunning = false;
  gamePaused = false;
  cancelAnimationFrame(animationId);
  updateStats();
  updateButtonState();
  showOverlay(`게임 종료\n점수: ${score}\n시작을 누르세요`);
}

function updateButtonState() {
  const hasClient = Boolean(supabaseClient);
  const canStart = hasClient && Boolean(currentUser);
  startButton.disabled = !canStart;
  pauseButton.disabled = !canStart || !gameRunning;
  endButton.disabled = !canStart || (!gameRunning && !gamePaused);
  logoutButton.disabled = !canStart;
  loginButton.disabled = !hasClient;
  authModeButton.disabled = !hasClient;
}

function showOverlay(message) {
  overlayTextElement.innerHTML = message.replace(/\n/g, "<br>");
  overlayElement.classList.remove("hidden");
}

function hideOverlay() {
  overlayElement.classList.add("hidden");
}

function toggleAuthMode() {
  isSignupMode = !isSignupMode;
  updateAuthModeUI();
}

function updateAuthModeUI() {
  authTitleElement.textContent = isSignupMode ? "회원가입" : "로그인";
  loginButton.textContent = isSignupMode ? "계정 만들기" : "로그인";
  authModeButton.textContent = isSignupMode ? "로그인으로 전환" : "회원가입으로 전환";
  loginIdLabel.textContent = "아이디";
  loginEmailInput.placeholder = isSignupMode ? "newplayer" : "admin";
  loginEmailInput.type = "text";
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!supabaseClient) {
    setLoginMessage("먼저 Supabase 정보를 저장하세요.", "error");
    return;
  }

  const loginValue = loginEmailInput.value.trim();
  const password = loginPwInput.value;

  if (isSignupMode) {
    if (!loginValue) {
      setLoginMessage("회원가입에는 아이디가 필요합니다.", "error");
      return;
    }

    await signUp(loginValue, password);
    return;
  }

  await login(loginValue, password);
}

async function signUp(loginId, password) {
  setLoginMessage("계정을 생성하는 중...", "");

  const existingProfile = await findProfileByLoginId(loginId);
  if (existingProfile) {
    setLoginMessage("이미 사용 중인 아이디입니다.", "error");
    showOverlay("회원가입 실패");
    return;
  }

  const email = buildLoginEmail(loginId);

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    setLoginMessage(error.message, "error");
    showOverlay("회원가입 실패");
    return;
  }

  if (!data.user) {
    setLoginMessage("회원가입은 완료되었지만 사용자 데이터가 반환되지 않았습니다.", "error");
    return;
  }

  if (!data.session) {
    currentUser = null;
    currentProfile = null;
    bestScore = 0;
    updateAuthUI();
    updateStats();
    updateButtonState();
    setLoginMessage("계정이 생성되었습니다. 아직 로그인할 수 없다면 이메일을 먼저 인증하거나 Supabase Auth 설정에서 이메일 인증을 끄세요.", "success");
    showOverlay("이메일 설정 확인");
    loginForm.reset();
    isSignupMode = false;
    updateAuthModeUI();
    return;
  }

  currentUser = data.user;
  await loadProfile();
  setLoginMessage("계정이 생성되었습니다. 이제 게임을 시작할 수 있습니다.", "success");
  updateAuthUI();
  updateStats();
  updateButtonState();
  hideOverlay();
  loginForm.reset();
  isSignupMode = false;
  updateAuthModeUI();
}

async function login(loginId, password) {
  setLoginMessage("로그인 중...", "");

  const loginEmail = await resolveLoginEmail(loginId);

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: loginEmail,
    password
  });

  if (error) {
    setLoginMessage("로그인에 실패했습니다. 아이디와 비밀번호를 확인하세요.", "error");
    showOverlay("로그인 실패");
    return;
  }

  currentUser = data.user;
  await loadProfile();
  setLoginMessage("로그인 완료. 이제 게임을 시작할 수 있습니다.", "success");
  updateAuthUI();
  updateStats();
  updateButtonState();
  hideOverlay();
  loginForm.reset();
}

async function logout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  gameRunning = false;
  gamePaused = false;
  cancelAnimationFrame(animationId);
  currentUser = null;
  currentProfile = null;
  bestScore = 0;
  score = 0;
  lines = 0;
  level = 1;
  board = createBoard();
  currentPiece = null;
  draw();
  updateStats();
  updateAuthUI();
  updateButtonState();
  setLoginMessage("로그아웃되었습니다.", "");
  showOverlay(supabaseClient ? "먼저 로그인하세요" : "먼저 Supabase를 연결하세요");
}

async function upsertProfile(loginId) {
  if (!supabaseClient || !currentUser) {
    return;
  }

  const existingBestScore = currentProfile ? Number(currentProfile.best_score || 0) : 0;
  const payload = {
    id: currentUser.id,
    login_id: loginId,
    login_email: currentUser.email,
    nickname: loginId,
    best_score: existingBestScore
  };

  const { error } = await supabaseClient.from("profiles").upsert(payload);

  if (error) {
    setLoginMessage(`프로필 저장 실패: ${error.message}`, "error");
  }
}

async function loadProfile() {
  if (!supabaseClient || !currentUser) {
    currentProfile = null;
    bestScore = 0;
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, login_id, login_email, nickname, best_score")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    currentProfile = null;
    bestScore = 0;
    setLoginMessage(`프로필 불러오기 실패: ${error.message}`, "error");
    return;
  }

  if (!data) {
    const fallbackLoginId = currentUser.email ? currentUser.email.split("@")[0] : "player";
    await upsertProfile(fallbackLoginId);
    return loadProfile();
  }

  currentProfile = data;
  bestScore = Number(data.best_score || 0);
}

function updateAuthUI() {
  if (!currentUser || !currentProfile) {
    userInfoElement.classList.add("hidden");
    return;
  }

  userNicknameElement.textContent = currentProfile.nickname;
  userIdElement.textContent = currentUser.email;
  userInfoElement.classList.remove("hidden");
}

function setLoginMessage(message, type) {
  loginMessageElement.textContent = message;
  loginMessageElement.classList.remove("error", "success");
  if (type) {
    loginMessageElement.classList.add(type);
  }
}

function setSupabaseMessage(message, type) {
  supabaseMessageElement.textContent = message;
  supabaseMessageElement.classList.remove("error", "success");
  if (type) {
    supabaseMessageElement.classList.add(type);
  }
}

async function findProfileByLoginId(loginId) {
  const { data, error } = await supabaseClient
    .rpc("get_login_profile", { target_login_id: loginId });

  if (error) {
    if (!isMissingRpcError(error)) {
      console.warn("아이디 확인 실패:", error);
    }

    return null;
  }

  return getFirstRow(data);
}

async function resolveLoginEmail(loginId) {
  const fallbackEmail = buildLoginEmail(loginId);
  const profile = await findProfileByLoginId(loginId);
  return profile && profile.login_email ? profile.login_email : fallbackEmail;
}

function getFirstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

function isMissingRpcError(error) {
  const text = `${error.code || ""} ${error.message || ""} ${error.details || ""} ${error.hint || ""}`;
  return text.includes("PGRST202") || text.includes("Could not find the function") || text.includes("schema cache");
}

function buildLoginEmail(loginId) {
  return `${loginId}@tetris.co.kr`;
}

restoreSupabaseSession();
