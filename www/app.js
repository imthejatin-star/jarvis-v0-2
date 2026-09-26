/*
========================================================
JARVIS v0.2 — LOCAL COMMAND ENGINE
File: www/app.js
========================================================
*/

const STORAGE = {
  conversation: "jarvis_v02_conversation",
  memories: "jarvis_v02_memories",
  tasks: "jarvis_v02_tasks"
};

const API_BASE_URL = "";
// Leave this empty for now.
// Later, when an eligible backend is available, we'll put its URL here.

let conversation = load(STORAGE.conversation, []);
let memories = load(STORAGE.memories, []);
let tasks = load(STORAGE.tasks, []);

let recognition = null;
let isListening = false;


/* ======================================================
   BASIC STORAGE
====================================================== */

function load(key, fallback) {
  try {
    const saved = localStorage.getItem(key);

    if (!saved) {
      return fallback;
    }

    return JSON.parse(saved);

  } catch (error) {
    console.error("Storage load error:", error);
    return fallback;
  }
}


function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Storage save error:", error);
  }
}


/* ======================================================
   DOM HELPERS
====================================================== */

const $ = selector => document.querySelector(selector);


function findAny(...selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);

    if (element) {
      return element;
    }
  }

  return null;
}


const chat =
  findAny(
    "#conversation",
    "#chat",
    ".conversation",
    ".messages"
  );


const input =
  findAny(
    "#messageInput",
    "#commandInput",
    "textarea",
    "input[type='text']"
  );


const sendButton =
  findAny(
    "#sendButton",
    "#sendBtn",
    ".send-button"
  );


const voiceButton =
  findAny(
    "#voiceButton",
    "#voiceBtn",
    ".voice-button"
  );


/* ======================================================
   MESSAGE UI
====================================================== */

function addMessage(role, text, options = {}) {

  if (!chat) {
    console.log(role.toUpperCase(), text);
    return;
  }

  const message = document.createElement("div");

  message.className =
    `message ${role === "user" ? "user-message" : "assistant-message"}`;

  message.textContent = text;

  if (options.temporary) {
    message.dataset.temporary = "true";
  }

  chat.appendChild(message);

  chat.scrollTop = chat.scrollHeight;

  return message;
}


function removeTemporaryMessages() {

  if (!chat) {
    return;
  }

  chat
    .querySelectorAll("[data-temporary='true']")
    .forEach(element => element.remove());
}


/* ======================================================
   CONVERSATION MEMORY
====================================================== */

function saveConversationMessage(role, content) {

  conversation.push({
    role,
    content,
    timestamp: Date.now()
  });

  // Keep local conversation manageable.
  if (conversation.length > 100) {
    conversation = conversation.slice(-100);
  }

  save(STORAGE.conversation, conversation);
}


function rememberConversation(role, text) {

  saveConversationMessage(role, text);
}


/* ======================================================
   MEMORY SYSTEM
====================================================== */

function addMemory(text) {

  const clean = text.trim();

  if (!clean) {
    return false;
  }

  const duplicate = memories.some(
    memory =>
      memory.text.toLowerCase() === clean.toLowerCase()
  );

  if (duplicate) {
    return false;
  }

  memories.push({
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()),

    text: clean,

    createdAt: new Date().toISOString()
  });

  save(STORAGE.memories, memories);

  renderMemories();

  return true;
}


function removeMemory(id) {

  memories =
    memories.filter(memory => memory.id !== id);

  save(STORAGE.memories, memories);

  renderMemories();
}


function clearMemories() {

  memories = [];

  save(STORAGE.memories, memories);

  renderMemories();
}


function getMemoryText() {

  if (!memories.length) {
    return "I don't have any saved memories yet.";
  }

  return [
    "Here is what I remember:",
    "",
    ...memories.map(
      (memory, index) =>
        `${index + 1}. ${memory.text}`
    )
  ].join("\n");
}


function renderMemories() {

  const container =
    findAny(
      "#memoryList",
      "#memories",
      ".memory-list"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!memories.length) {

    container.innerHTML =
      `<div class="empty-state">No memories yet.</div>`;

    return;
  }

  memories.forEach(memory => {

    const item =
      document.createElement("div");

    item.className = "memory-item";

    item.innerHTML = `
      <span>${escapeHTML(memory.text)}</span>
      <button type="button" data-memory-id="${memory.id}">
        Delete
      </button>
    `;

    container.appendChild(item);
  });


  container
    .querySelectorAll("[data-memory-id]")
    .forEach(button => {

      button.addEventListener("click", () => {

        removeMemory(button.dataset.memoryId);

      });

    });
}


/* ======================================================
   TASK SYSTEM
====================================================== */

function addTask(text) {

  const clean = text.trim();

  if (!clean) {
    return null;
  }

  const task = {

    id:
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()),

    text: clean,

    completed: false,

    createdAt: new Date().toISOString(),

    completedAt: null
  };

  tasks.push(task);

  save(STORAGE.tasks, tasks);

  renderTasks();

  return task;
}


function completeTask(identifier) {

  const query =
    identifier
      .trim()
      .toLowerCase();

  let task =
    tasks.find(
      item =>
        item.id === identifier
    );

  if (!task) {

    task =
      tasks.find(
        item =>
          !item.completed &&
          item.text
            .toLowerCase()
            .includes(query)
      );

  }

  if (!task) {
    return null;
  }

  task.completed = true;

  task.completedAt =
    new Date().toISOString();

  save(STORAGE.tasks, tasks);

  renderTasks();

  return task;
}


function deleteTask(identifier) {

  const query =
    identifier
      .trim()
      .toLowerCase();

  const originalLength =
    tasks.length;

  tasks =
    tasks.filter(task => {

      if (task.id === identifier) {
        return false;
      }

      if (
        task.text
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }

      return true;
    });

  save(STORAGE.tasks, tasks);

  renderTasks();

  return tasks.length !== originalLength;
}


function clearCompletedTasks() {

  tasks =
    tasks.filter(task => !task.completed);

  save(STORAGE.tasks, tasks);

  renderTasks();
}


function getTaskText() {

  if (!tasks.length) {
    return "You don't have any tasks.";
  }

  const active =
    tasks.filter(task => !task.completed);

  const completed =
    tasks.filter(task => task.completed);

  const lines = [
    `You have ${active.length} active task${active.length === 1 ? "" : "s"} and ${completed.length} completed.`,
    ""
  ];

  if (active.length) {

    lines.push("Active:");

    active.forEach((task, index) => {

      lines.push(
        `${index + 1}. ${task.text}`
      );

    });
  }

  if (completed.length) {

    lines.push("");

    lines.push("Completed:");

    completed.forEach(task => {

      lines.push(
        `✓ ${task.text}`
      );

    });
  }

  return lines.join("\n");
}


function renderTasks() {

  const container =
    findAny(
      "#taskList",
      "#tasks",
      ".task-list"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!tasks.length) {

    container.innerHTML =
      `<div class="empty-state">No tasks yet.</div>`;

    return;
  }

  tasks.forEach(task => {

    const item =
      document.createElement("div");

    item.className =
      `task-item ${task.completed ? "completed" : ""}`;

    item.innerHTML = `
      <div>
        <strong>
          ${escapeHTML(task.text)}
        </strong>
      </div>

      <div class="task-actions">

        ${
          task.completed
            ? ""
            : `
              <button
                type="button"
                data-complete-id="${task.id}">
                Complete
              </button>
            `
        }

        <button
          type="button"
          data-delete-id="${task.id}">
          Delete
        </button>

      </div>
    `;

    container.appendChild(item);
  });


  container
    .querySelectorAll("[data-complete-id]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          completeTask(
            button.dataset.completeId
          );

        }
      );

    });


  container
    .querySelectorAll("[data-delete-id]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteTask(
            button.dataset.deleteId
          );

        }
      );

    });
}


/* ======================================================
   DATE + TIME
====================================================== */

function currentTime() {

  return new Date().toLocaleTimeString(
    "en-IN",
    {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    }
  );
}


function currentDate() {

  return new Date().toLocaleDateString(
    "en-IN",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    }
  );
}


/* ======================================================
   CALCULATOR
====================================================== */

function calculate(expression) {

  let clean =
    expression
      .replace(/what is/gi, "")
      .replace(/calculate/gi, "")
      .replace(/solve/gi, "")
      .replace(/=/g, "")
      .trim();

  if (!clean) {
    return null;
  }

  /*
   Only allow calculator characters.
   No variables.
   No functions.
   No access to JavaScript objects.
  */

  if (!/^[0-9+\-*/().%\s]+$/.test(clean)) {
    return null;
  }

  try {

    const result =
      Function(
        `"use strict"; return (${clean})`
      )();

    if (
      typeof result !== "number" ||
      !Number.isFinite(result)
    ) {
      return null;
    }

    return result;

  } catch {
    return null;
  }
}


/* ======================================================
   INTENT DETECTION
====================================================== */

function detectIntent(raw) {

  const text =
    raw
      .trim()
      .toLowerCase();


  if (!text) {
    return "empty";
  }


  if (
    text === "hi" ||
    text === "hello" ||
    text === "hey" ||
    text.startsWith("hey jarvis")
  ) {
    return "greeting";
  }


  if (
    text.includes("what can you do") ||
    text.includes("your capabilities") ||
    text.includes("help") ||
    text === "capabilities"
  ) {
    return "capabilities";
  }


  if (
    text.includes("what time") ||
    text === "time" ||
    text.includes("current time")
  ) {
    return "time";
  }


  if (
    text.includes("what date") ||
    text === "date" ||
    text.includes("today's date") ||
    text.includes("todays date")
  ) {
    return "date";
  }


  if (
    text.startsWith("remember that ") ||
    text.startsWith("remember ")
  ) {
    return "remember";
  }


  if (
    text.includes("what do you remember") ||
    text.includes("show memories") ||
    text.includes("my memories") ||
    text.includes("what you remember")
  ) {
    return "show_memories";
  }


  if (
    text.includes("forget everything") ||
    text.includes("clear memories") ||
    text.includes("forget all memories")
  ) {
    return "clear_memories";
  }


  if (
    text.startsWith("add task") ||
    text.startsWith("create task") ||
    text.startsWith("new task") ||
    text.startsWith("remind me to") ||
    text.startsWith("remind me ")
  ) {
    return "add_task";
  }


  if (
    text.includes("show tasks") ||
    text.includes("my tasks") ||
    text.includes("list tasks") ||
    text.includes("what are my tasks")
  ) {
    return "show_tasks";
  }


  if (
    text.startsWith("complete task") ||
    text.startsWith("finish task") ||
    text.startsWith("mark task")
  ) {
    return "complete_task";
  }


  if (
    text.includes("clear completed tasks") ||
    text.includes("delete completed tasks")
  ) {
    return "clear_completed";
  }


  if (
    text.startsWith("delete task") ||
    text.startsWith("remove task")
  ) {
    return "delete_task";
  }


  if (
    text.startsWith("what is ") ||
    text.startsWith("calculate ") ||
    text.startsWith("solve ")
  ) {

    const result =
      calculate(text);

    if (result !== null) {
      return "calculator";
    }
  }


  /*
   Detect direct mathematical expressions.
  */

  if (
    /^[0-9+\-*/().%\s]+$/.test(text)
  ) {

    if (/[+\-*/%]/.test(text)) {
      return "calculator";
    }
  }


  return "unknown";
}


/* ======================================================
   COMMAND HANDLER
====================================================== */

async function handleLocalCommand(message) {

  const text =
    message.trim();

  const intent =
    detectIntent(text);


  switch (intent) {

    case "empty":

      return "I'm listening.";


    case "greeting":

      return "Hello. JARVIS is online and ready.";


    case "capabilities":

      return [
        "Currently available locally:",
        "",
        "• Conversation history",
        "• Long-term local memories",
        "• Task management",
        "• Calculator",
        "• Date and time",
        "• Voice input",
        "• Voice output",
        "• Local command detection",
        "• Permission-ready architecture",
        "",
        "Cloud AI and web tools are not connected yet."
      ].join("\n");


    case "time":

      return `The current time is ${currentTime()}.`;


    case "date":

      return `Today is ${currentDate()}.`;


    case "remember": {

      let memory =
        text
          .replace(/^remember that\s*/i, "")
          .replace(/^remember\s*/i, "")
          .trim();

      if (!memory) {
        return "What would you like me to remember?";
      }

      const added =
        addMemory(memory);

      if (!added) {
        return "I already have that memory saved.";
      }

      return `Understood. I'll remember: ${memory}`;
    }


    case "show_memories":

      return getMemoryText();


    case "clear_memories":

      clearMemories();

      return "All saved memories have been cleared.";


    case "add_task": {

      let taskText =
        text
          .replace(/^add task\s*:?\s*/i, "")
          .replace(/^create task\s*:?\s*/i, "")
          .replace(/^new task\s*:?\s*/i, "")
          .replace(/^remind me to\s*/i, "")
          .replace(/^remind me\s*/i, "")
          .trim();

      if (!taskText) {
        return "Tell me what task you'd like me to add.";
      }

      const task =
        addTask(taskText);

      if (!task) {
        return "I couldn't create that task.";
      }

      return `Task added: ${task.text}`;
    }


    case "show_tasks":

      return getTaskText();


    case "complete_task": {

      let query =
        text
          .replace(/^complete task\s*:?\s*/i, "")
          .replace(/^finish task\s*:?\s*/i, "")
          .replace(/^mark task\s*:?\s*/i, "")
          .replace(/^as completed\s*/i, "")
          .trim();

      if (!query) {
        return "Tell me which task you completed.";
      }

      const task =
        completeTask(query);

      if (!task) {
        return `I couldn't find an active task matching "${query}".`;
      }

      return `Task completed: ${task.text}`;
    }


    case "delete_task": {

      const query =
        text
          .replace(/^delete task\s*:?\s*/i, "")
          .replace(/^remove task\s*:?\s*/i, "")
          .trim();

      if (!query) {
        return "Tell me which task you want to delete.";
      }

      const deleted =
        deleteTask(query);

      if (!deleted) {
        return `I couldn't find a task matching "${query}".`;
      }

      return `Task deleted.`;
    }


    case "clear_completed":

      clearCompletedTasks();

      return "Completed tasks have been cleared.";


    case "calculator": {

      const result =
        calculate(text);

      if (result === null) {
        return "I couldn't safely calculate that expression.";
      }

      return `The answer is ${result}.`;
    }


    default:

      return null;
  }
}


/* ======================================================
   AI BACKEND FALLBACK
====================================================== */

async function askAI(message) {

  if (!API_BASE_URL) {
    return null;
  }

  try {

    const response =
      await fetch(
        `${API_BASE_URL}/api/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            message,
            conversation:
              conversation
                .slice(-20)
                .map(item => ({
                  role: item.role,
                  content: item.content
                }))
          })
        }
      );


    if (!response.ok) {
      throw new Error(
        `Backend returned ${response.status}`
      );
    }


    const data =
      await response.json();


    if (
      !data.success ||
      typeof data.reply !== "string"
    ) {
      throw new Error(
        "Invalid backend response."
      );
    }


    return data.reply.trim();

  } catch (error) {

    console.error(
      "AI backend error:",
      error
    );

    return null;
  }
}


/* ======================================================
   MAIN MESSAGE PROCESSOR
====================================================== */

async function processMessage(message) {

  const clean =
    message.trim();

  if (!clean) {
    return;
  }


  addMessage(
    "user",
    clean
  );

  rememberConversation(
    "user",
    clean
  );


  const typing =
    addMessage(
      "assistant",
      "JARVIS is thinking...",
      {
        temporary: true
      }
    );


  /*
   First use the local command engine.
  */

  let reply =
    await handleLocalCommand(clean);


  /*
   If the local engine doesn't understand it,
   try the cloud backend if one is configured.
  */

  if (!reply) {

    reply =
      await askAI(clean);

  }


  /*
   If neither understands it.
  */

  if (!reply) {

    reply =
      `I understand the command structure, but that capability isn't connected yet.\n\nTry "What can you do?" to see my current capabilities.`;

  }


  if (typing) {
    typing.remove();
  }

  addMessage(
    "assistant",
    reply
  );

  rememberConversation(
    "assistant",
    reply
  );


  speak(reply);

  updateDashboard();
}


/* ======================================================
   SEND MESSAGE
====================================================== */

function sendMessage() {

  if (!input) {
    return;
  }

  const message =
    input.value.trim();

  if (!message) {
    return;
  }

  input.value = "";

  processMessage(message);
}


/* ======================================================
   VOICE RECOGNITION
====================================================== */

function setupVoiceRecognition() {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


  if (!SpeechRecognition) {

    console.warn(
      "Speech recognition is not supported."
    );

    return;
  }


  recognition =
    new SpeechRecognition();


  recognition.lang = "en-IN";

  recognition.interimResults = false;

  recognition.continuous = false;


  recognition.onstart = () => {

    isListening = true;

    updateVoiceButton();

  };


  recognition.onresult = event => {

    const transcript =
      event.results[0][0].transcript;

    if (input) {
      input.value = transcript;
    }

    processMessage(transcript);

  };


  recognition.onerror = event => {

    console.error(
      "Voice recognition error:",
      event.error
    );

  };


  recognition.onend = () => {

    isListening = false;

    updateVoiceButton();

  };
}


function toggleVoice() {

  if (!recognition) {

    alert(
      "Voice recognition is not available on this device/browser."
    );

    return;
  }


  if (isListening) {

    recognition.stop();

  } else {

    recognition.start();

  }
}


function updateVoiceButton() {

  if (!voiceButton) {
    return;
  }

  voiceButton.classList.toggle(
    "listening",
    isListening
  );

  voiceButton.setAttribute(
    "aria-label",
    isListening
      ? "Stop listening"
      : "Start voice input"
  );
}


/* ======================================================
   TEXT TO SPEECH
====================================================== */

function speak(text) {

  if (
    !("speechSynthesis" in window)
  ) {
    return;
  }


  window.speechSynthesis.cancel();


  /*
   Don't read huge responses aloud.
  */

  const spoken =
    text.length > 800
      ? `${text.slice(0, 800)}.`
      : text;


  const utterance =
    new SpeechSynthesisUtterance(
      spoken
    );


  utterance.lang = "en-IN";

  utterance.rate = 0.95;

  utterance.pitch = 0.9;

  utterance.volume = 1;


  window.speechSynthesis.speak(
    utterance
  );
}


/* ======================================================
   QUICK COMMANDS
====================================================== */

function setupQuickCommands() {

  const buttons =
    document.querySelectorAll(
      "[data-command]"
    );


  buttons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const command =
          button.dataset.command;

        if (!command) {
          return;
        }

        if (input) {
          input.value = command;
        }

        processMessage(command);

      }
    );

  });
}


/*
Support buttons whose text contains known commands,
even if data-command wasn't added to the HTML.
*/

function setupFallbackQuickCommands() {

  const buttons =
    document.querySelectorAll(
      "button"
    );


  buttons.forEach(button => {

    if (
      button === sendButton ||
      button === voiceButton
    ) {
      return;
    }


    const text =
      button.textContent
        .trim()
        .toLowerCase();


    let command = null;


    if (
      text.includes("capabilit")
    ) {
      command = "What can you do?";
    }

    else if (
      text.includes("time")
    ) {
      command = "What time is it?";
    }

    else if (
      text.includes("calculator") ||
      text.includes("calculate")
    ) {
      command = "What is 245 * 37?";
    }

    else if (
      text.includes("task")
    ) {
      command = "Show my tasks";
    }


    if (!command) {
      return;
    }


    button.addEventListener(
      "click",
      () => {

        if (input) {
          input.value = command;
        }

        processMessage(command);

      }
    );

  });
}


/* ======================================================
   DASHBOARD
====================================================== */

function updateDashboard() {

  const memoryCount =
    findAny(
      "#memoryCount",
      "[data-memory-count]"
    );

  const taskCount =
    findAny(
      "#taskCount",
      "[data-task-count]"
    );


  if (memoryCount) {

    memoryCount.textContent =
      memories.length;

  }


  if (taskCount) {

    taskCount.textContent =
      tasks.filter(
        task => !task.completed
      ).length;

  }


  renderMemories();

  renderTasks();
}


/* ======================================================
   HTML ESCAPING
====================================================== */

function escapeHTML(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* ======================================================
   ENTER KEY
====================================================== */

function setupKeyboard() {

  if (!input) {
    return;
  }


  input.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendMessage();

      }

    }
  );
}


/* ======================================================
   BUTTONS
====================================================== */

function setupButtons() {

  if (sendButton) {

    sendButton.addEventListener(
      "click",
      sendMessage
    );

  }


  if (voiceButton) {

    voiceButton.addEventListener(
      "click",
      toggleVoice
    );

  }

}


/* ======================================================
   INITIAL MESSAGE
====================================================== */

function initializeConversation() {

  if (!chat) {
    return;
  }


  chat.innerHTML = "";


  if (!conversation.length) {

    const welcome =
      "JARVIS is online. Local command systems are ready.";

    addMessage(
      "assistant",
      welcome
    );

    rememberConversation(
      "assistant",
      welcome
    );

    return;
  }


  /*
   Restore recent conversation.
  */

  conversation
    .slice(-30)
    .forEach(item => {

      addMessage(
        item.role,
        item.content
      );

    });
}


/* ======================================================
   INITIALIZATION
====================================================== */

function init() {

  initializeConversation();

  renderMemories();

  renderTasks();

  updateDashboard();

  setupButtons();

  setupKeyboard();

  setupVoiceRecognition();

  setupQuickCommands();

  setupFallbackQuickCommands();

  console.log(
    "JARVIS v0.2 local command engine initialized."
  );

}


document.addEventListener(
  "DOMContentLoaded",
  init
);
