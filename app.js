const DEFAULT_OUTPUT = "No output yet.";
const THEME_STORAGE_KEY = "docktools-theme";
const themeToggle = document.getElementById("themeToggle");

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures (private mode or blocked storage).
  }
}

function resolveInitialTheme() {
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", nextTheme);
  if (!themeToggle) return;
  if (nextTheme === "dark") {
    themeToggle.textContent = "Light mode";
    themeToggle.setAttribute("aria-label", "Switch to light mode");
  } else {
    themeToggle.textContent = "Dark mode";
    themeToggle.setAttribute("aria-label", "Switch to dark mode");
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const nextTheme = isDark ? "light" : "dark";
  applyTheme(nextTheme);
  storeTheme(nextTheme);
}

function setStatus(el, message, kind = "info") {
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind;
}

function setOutput(el, text, emptyText = DEFAULT_OUTPUT) {
  if (!el) return;
  const trimmed = text && text.trim().length ? text.trim() : "";
  el.textContent = trimmed || emptyText;
}

function setNotes(el, notes) {
  if (!el) return;
  if (!notes || notes.length === 0) {
    el.textContent = "No notes.";
    return;
  }
  el.textContent = notes.map((note) => `- ${note}`).join("\n");
}

function copyOutput(preEl, statusEl) {
  if (!preEl) return;
  const text = preEl.textContent.trim();
  if (!text || text === DEFAULT_OUTPUT) {
    setStatus(statusEl, "Nothing to copy yet.", "warn");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => setStatus(statusEl, "Copied to clipboard.", "success"),
    () => setStatus(statusEl, "Clipboard permission denied.", "error")
  );
}

function lines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function shellEscape(value) {
  if (value === undefined || value === null) {
    return "";
  }
  const text = String(value);
  if (/^[A-Za-z0-9._/:=-]+$/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, "\\\"")}"`;
}

function normalizeDuration(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (/\d$/.test(trimmed)) {
    return `${trimmed}s`;
  }
  return trimmed;
}

function parseEnvLines(envLines) {
  const keyValueOnly = envLines.every((line) => line.includes("="));
  if (!keyValueOnly) {
    return envLines;
  }
  const envObj = {};
  envLines.forEach((line) => {
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    envObj[key] = value;
  });
  return envObj;
}

const HELP_TEXT = {
  composeInput: "Paste Compose YAML. Full files and services-only snippets are both accepted.",
  runInput: "Paste one docker run command. Supported flags are converted automatically.",
  dfBase: "Base image used in the FROM instruction.",
  dfWorkdir: "Default working directory inside the container.",
  dfCopy: "Each line should be source and destination, for example . /app.",
  dfRun: "Each line becomes one RUN instruction during image build.",
  dfEnv: "Environment variables written as KEY=VALUE.",
  dfExpose: "Ports documented as listening inside the container.",
  dfEntrypoint: "Startup executable, usually JSON array format.",
  dfCmd: "Default command arguments when the container starts.",
  rbImage: "Image name to run, including optional tag.",
  rbName: "Container name shown in docker ps.",
  rbPorts: "Host to container mappings like 8080:80.",
  rbEnv: "Environment variables passed to the container.",
  rbVolumes: "Mounts using SRC:DEST or SRC:DEST:MODE.",
  rbRestart: "How Docker restarts the container after exit.",
  rbNetwork: "Network to attach this container to.",
  rbWorkdir: "Working directory for the main process.",
  rbUser: "User or UID:GID used by the process.",
  rbEntrypoint: "Override the image entrypoint executable.",
  rbCommand: "Command appended after the image name.",
  rbDetach: "Run in background and return terminal immediately.",
  rbRm: "Auto-remove container when it exits.",
  rbPrivileged: "Give broad host capabilities. Use only when required.",
  rbTty: "Allocate a terminal device for interactive use.",
  rbInteractive: "Keep STDIN open for interactive commands.",
  cbService: "Service key used under services in compose.",
  cbImage: "Image name and optional tag for this service.",
  cbContainer: "Optional fixed container name in Compose.",
  cbPorts: "Port mappings like host:container per line.",
  cbEnv: "Environment values in KEY=VALUE format.",
  cbVolumes: "Mount paths per line in SRC:DEST format.",
  cbCommand: "Override the default command for the image.",
  cbEntrypoint: "Override the entrypoint for this service.",
  cbRestart: "Container restart behavior in Compose.",
  cbNetwork: "Set network_mode such as bridge or host.",
  cbDepends: "Service names that should start first.",
  cbWorkdir: "Working directory inside the container.",
  cbUser: "User or UID:GID for the container process.",
  cbTty: "Enable terminal allocation in Compose.",
  cbStdin: "Keep STDIN open for this service.",
  envInput: "Raw .env lines with one KEY=VALUE per line.",
  composeEnvInput: "Compose environment object or list format.",
  portInput: "Enter one port mapping per line to explain.",
  volType: "Choose bind mount, named volume, or anonymous volume.",
  volSource: "Host path or volume name depending on type.",
  volTarget: "Destination path inside the container.",
  volMode: "Read-only (ro) or default read-write.",
  imgInput: "Container image reference with optional tag or digest.",
  healthCmd: "Command Docker runs to check container health.",
  healthInterval: "Time between health checks, for example 30s.",
  healthTimeout: "Max wait per health check, for example 5s.",
  healthRetries: "Failed checks required before unhealthy state.",
  healthStart: "Grace period before health checks begin.",
  netService: "Service name receiving network config.",
  netName: "Compose network key to create or reuse.",
  netAliases: "Optional DNS aliases visible on that network.",
  formatInput: "Paste YAML or JSON to normalize and reformat.",
};

function createHelpTooltip(fieldId, text) {
  const wrapper = document.createElement("span");
  wrapper.className = "help-wrap";

  const dot = document.createElement("button");
  dot.type = "button";
  dot.className = "help-dot";
  dot.dataset.helpFor = fieldId;
  dot.setAttribute("aria-label", `Info about ${fieldId}`);
  dot.textContent = "?";

  const tooltip = document.createElement("span");
  tooltip.className = "help-tip";
  tooltip.textContent = text;

  wrapper.appendChild(dot);
  wrapper.appendChild(tooltip);
  return wrapper;
}

function resolveHelpAnchor(field) {
  const fieldLabel = field.closest("label.field");
  if (fieldLabel) {
    const heading = fieldLabel.querySelector("span");
    if (heading) return heading;
  }

  const checkLabel = field.closest("label.check");
  if (checkLabel) {
    return checkLabel;
  }

  const panel = field.closest(".panel");
  if (panel) {
    const panelHeading = panel.querySelector(".panel-header h2");
    if (panelHeading) return panelHeading;
  }

  return null;
}

function addHelpTooltips() {
  Object.entries(HELP_TEXT).forEach(([fieldId, text]) => {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const anchor = resolveHelpAnchor(field);
    if (!anchor) return;
    if (anchor.querySelector(`.help-dot[data-help-for="${fieldId}"]`)) return;

    anchor.appendChild(createHelpTooltip(fieldId, text));
  });
}

// Tabs
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");

function activateTab(tabId) {
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabId}`);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

// Compose <-> Run converter
const composeInput = document.getElementById("composeInput");
const runInput = document.getElementById("runInput");
const outputConvert = document.getElementById("outputConvert");
const notesConvert = document.getElementById("notesConvert");
const statusConvert = document.getElementById("statusConvert");


function normalizeCompose(doc) {
  if (!doc) return null;
  if (doc.services && typeof doc.services === "object") {
    return doc.services;
  }
  const likelyService = ["image", "build", "command", "ports", "environment", "volumes"].some(
    (key) => Object.prototype.hasOwnProperty.call(doc, key)
  );
  if (likelyService) {
    return { service: doc };
  }
  const services = {};
  let count = 0;
  for (const [name, value] of Object.entries(doc)) {
    if (value && typeof value === "object") {
      const looksLikeService = ["image", "build", "command", "ports", "environment", "volumes"].some(
        (key) => Object.prototype.hasOwnProperty.call(value, key)
      );
      if (looksLikeService) {
        services[name] = value;
        count += 1;
      }
    }
  }
  return count ? services : null;
}

function parsePort(port) {
  if (typeof port === "string" || typeof port === "number") {
    return String(port);
  }
  if (port && typeof port === "object") {
    const published = port.published || port.host_port || "";
    const target = port.target || port.container_port || "";
    const protocol = port.protocol ? `/${port.protocol}` : "";
    if (published && target) {
      return `${published}:${target}${protocol}`;
    }
  }
  return null;
}

function parseVolume(volume) {
  if (typeof volume === "string") {
    return volume;
  }
  if (volume && typeof volume === "object") {
    const source = volume.source || volume.src || "";
    const target = volume.target || volume.dst || volume.destination || "";
    const mode = volume.read_only ? "ro" : volume.mode || "";
    if (source && target) {
      return mode ? `${source}:${target}:${mode}` : `${source}:${target}`;
    }
  }
  return null;
}

function composeToRun(yamlText) {
  if (!window.jsyaml) {
    throw new Error("YAML parser missing.");
  }
  const notes = [];
  let doc;
  try {
    doc = window.jsyaml.load(yamlText);
  } catch (error) {
    throw new Error(`Compose parse error: ${error.message}`);
  }

  const services = normalizeCompose(doc);
  if (!services) {
    throw new Error("No services found. Paste a compose file or a services block.");
  }

  const commands = [];

  for (const [name, svc] of Object.entries(services)) {
    const args = ["docker", "run"];

    if (svc.container_name) {
      args.push("--name", shellEscape(svc.container_name));
    }
    if (svc.restart) {
      args.push("--restart", shellEscape(svc.restart));
    }
    if (svc.network_mode) {
      args.push("--network", shellEscape(svc.network_mode));
    }
    if (svc.user) {
      args.push("--user", shellEscape(svc.user));
    }
    if (svc.working_dir) {
      args.push("--workdir", shellEscape(svc.working_dir));
    }
    if (svc.entrypoint) {
      const entry = Array.isArray(svc.entrypoint)
        ? svc.entrypoint.map(shellEscape).join(" ")
        : shellEscape(svc.entrypoint);
      args.push("--entrypoint", entry);
    }
    if (svc.privileged) {
      args.push("--privileged");
    }
    if (svc.tty) {
      args.push("-t");
    }
    if (svc.stdin_open) {
      args.push("-i");
    }
    if (svc.ports) {
      for (const port of svc.ports) {
        const parsed = parsePort(port);
        if (parsed) {
          args.push("-p", shellEscape(parsed));
        }
      }
    }
    if (svc.environment) {
      if (Array.isArray(svc.environment)) {
        svc.environment.forEach((item) => args.push("-e", shellEscape(item)));
      } else {
        Object.entries(svc.environment).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            args.push("-e", shellEscape(key));
          } else {
            args.push("-e", shellEscape(`${key}=${value}`));
          }
        });
      }
    }
    if (svc.volumes) {
      for (const volume of svc.volumes) {
        const parsed = parseVolume(volume);
        if (parsed) {
          args.push("-v", shellEscape(parsed));
        }
      }
    }
    if (svc.labels) {
      if (Array.isArray(svc.labels)) {
        svc.labels.forEach((label) => args.push("--label", shellEscape(label)));
      } else {
        Object.entries(svc.labels).forEach(([key, value]) => {
          args.push("--label", shellEscape(`${key}=${value}`));
        });
      }
    }
    if (svc.extra_hosts) {
      if (Array.isArray(svc.extra_hosts)) {
        svc.extra_hosts.forEach((host) => args.push("--add-host", shellEscape(host)));
      } else {
        Object.entries(svc.extra_hosts).forEach(([host, ip]) => {
          args.push("--add-host", shellEscape(`${host}:${ip}`));
        });
      }
    }
    if (svc.build) {
      notes.push(`Service "${name}" uses build. Replace IMAGE with a built image name.`);
    }
    if (svc.depends_on) {
      notes.push(`Service "${name}" depends_on is not represented in docker run.`);
    }
    if (svc.env_file) {
      notes.push(`Service "${name}" uses env_file. Add it manually to docker run.`);
    }

    const image = svc.image ? shellEscape(svc.image) : "IMAGE";
    args.push(image);

    if (svc.command) {
      const command = Array.isArray(svc.command)
        ? svc.command.map(shellEscape).join(" ")
        : svc.command;
      args.push(command);
    }

    commands.push(args.join(" "));
  }

  return { output: commands.join("\n\n"), notes };
}

function tokenizeCommand(command) {
  const tokens = [];
  const regex = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`|[^\s]+/g;
  const matches = command.match(regex) || [];
  for (const match of matches) {
    if ((match.startsWith("\"") && match.endsWith("\"")) || (match.startsWith("'") && match.endsWith("'"))) {
      tokens.push(match.slice(1, -1).replace(/\\"/g, "\"").replace(/\\'/g, "'"));
    } else {
      tokens.push(match);
    }
  }
  return tokens;
}

function deriveServiceName(image, fallback = "service") {
  if (!image) return fallback;
  const namePart = image.split("/").pop() || fallback;
  const base = namePart.split(":")[0] || fallback;
  const cleaned = base.replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned ? cleaned.toLowerCase() : fallback;
}

function sanitizeServiceName(name, fallback = "service") {
  if (!name) return fallback;
  const cleaned = String(name).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return cleaned || fallback;
}

function readInlineFlag(token, flag) {
  if (token.startsWith(`${flag}=`)) {
    return token.slice(flag.length + 1);
  }
  return null;
}

function runToCompose(commandText) {
  if (!window.jsyaml) {
    throw new Error("YAML parser missing.");
  }
  const tokens = tokenizeCommand(commandText);
  if (!tokens.length) {
    throw new Error("Paste a docker run command first.");
  }

  const config = {
    ports: [],
    env: [],
    volumes: [],
    labels: [],
    extraHosts: [],
    unknown: [],
    notes: [],
    command: [],
  };

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === "docker" || token === "run") {
      i += 1;
      continue;
    }

    const inlineName = readInlineFlag(token, "--name");
    if (inlineName) {
      config.name = inlineName;
      i += 1;
      continue;
    }
    const inlineRestart = readInlineFlag(token, "--restart");
    if (inlineRestart) {
      config.restart = inlineRestart;
      i += 1;
      continue;
    }
    const inlineNetwork = readInlineFlag(token, "--network");
    if (inlineNetwork) {
      config.network = inlineNetwork;
      i += 1;
      continue;
    }
    const inlineEntry = readInlineFlag(token, "--entrypoint");
    if (inlineEntry) {
      config.entrypoint = inlineEntry;
      i += 1;
      continue;
    }
    const inlineWorkdir = readInlineFlag(token, "--workdir");
    if (inlineWorkdir) {
      config.workingDir = inlineWorkdir;
      i += 1;
      continue;
    }
    const inlineUser = readInlineFlag(token, "--user");
    if (inlineUser) {
      config.user = inlineUser;
      i += 1;
      continue;
    }
    const inlineEnv = readInlineFlag(token, "--env");
    if (inlineEnv) {
      config.env.push(inlineEnv);
      i += 1;
      continue;
    }
    const inlinePublish = readInlineFlag(token, "--publish");
    if (inlinePublish) {
      config.ports.push(inlinePublish);
      i += 1;
      continue;
    }
    const inlineVolume = readInlineFlag(token, "--volume");
    if (inlineVolume) {
      config.volumes.push(inlineVolume);
      i += 1;
      continue;
    }
    const inlineLabel = readInlineFlag(token, "--label");
    if (inlineLabel) {
      config.labels.push(inlineLabel);
      i += 1;
      continue;
    }
    const inlineHost = readInlineFlag(token, "--add-host");
    if (inlineHost) {
      config.extraHosts.push(inlineHost);
      i += 1;
      continue;
    }
    const inlineEnvFile = readInlineFlag(token, "--env-file");
    if (inlineEnvFile) {
      config.notes.push(`env-file: ${inlineEnvFile}`);
      i += 1;
      continue;
    }

    if (token === "--name") {
      config.name = tokens[i + 1];
      i += 2;
      continue;
    }
    if (token === "--restart") {
      config.restart = tokens[i + 1];
      i += 2;
      continue;
    }
    if (token === "--network") {
      config.network = tokens[i + 1];
      i += 2;
      continue;
    }
    if (token === "--entrypoint") {
      config.entrypoint = tokens[i + 1];
      i += 2;
      continue;
    }
    if (token === "--workdir" || token === "-w") {
      config.workingDir = tokens[i + 1];
      i += 2;
      continue;
    }
    if (token === "--user" || token === "-u") {
      config.user = tokens[i + 1];
      i += 2;
      continue;
    }
    if (token === "-p" || token === "--publish") {
      config.ports.push(tokens[i + 1]);
      i += 2;
      continue;
    }
    if (token.startsWith("-p") && token.length > 2) {
      config.ports.push(token.slice(2));
      i += 1;
      continue;
    }
    if (token === "-e" || token === "--env") {
      config.env.push(tokens[i + 1]);
      i += 2;
      continue;
    }
    if (token.startsWith("-e") && token.length > 2) {
      config.env.push(token.slice(2));
      i += 1;
      continue;
    }
    if (token === "-v" || token === "--volume") {
      config.volumes.push(tokens[i + 1]);
      i += 2;
      continue;
    }
    if (token.startsWith("-v") && token.length > 2) {
      config.volumes.push(token.slice(2));
      i += 1;
      continue;
    }
    if (token === "-l" || token === "--label") {
      config.labels.push(tokens[i + 1]);
      i += 2;
      continue;
    }
    if (token === "--add-host") {
      config.extraHosts.push(tokens[i + 1]);
      i += 2;
      continue;
    }
    if (token === "--privileged") {
      config.privileged = true;
      i += 1;
      continue;
    }
    if (token === "-i" || token === "--interactive") {
      config.stdinOpen = true;
      i += 1;
      continue;
    }
    if (token === "-t" || token === "--tty") {
      config.tty = true;
      i += 1;
      continue;
    }
    if (token === "-it" || token === "-ti") {
      config.stdinOpen = true;
      config.tty = true;
      i += 1;
      continue;
    }
    if (token === "--rm") {
      config.rm = true;
      i += 1;
      continue;
    }
    if (token === "-d" || token === "--detach") {
      config.detach = true;
      i += 1;
      continue;
    }
    if (token === "--env-file") {
      config.notes.push(`env-file: ${tokens[i + 1]}`);
      i += 2;
      continue;
    }
    if (token === "--") {
      config.command = tokens.slice(i + 1);
      break;
    }
    if (token.startsWith("-")) {
      config.unknown.push(token);
      i += 1;
      continue;
    }

    config.image = token;
    config.command = tokens.slice(i + 1);
    break;
  }

  if (!config.image) {
    throw new Error("Could not find the image name in the docker run command.");
  }

  const serviceName = sanitizeServiceName(config.name || deriveServiceName(config.image));
  const service = {};

  service.image = config.image;
  if (config.name) service.container_name = config.name;
  if (config.ports.length) service.ports = config.ports;
  if (config.env.length) service.environment = config.env;
  if (config.volumes.length) service.volumes = config.volumes;
  if (config.command.length) service.command = config.command;
  if (config.entrypoint) service.entrypoint = config.entrypoint;
  if (config.workingDir) service.working_dir = config.workingDir;
  if (config.user) service.user = config.user;
  if (config.restart) service.restart = config.restart;
  if (config.network) service.network_mode = config.network;
  if (config.privileged) service.privileged = true;
  if (config.stdinOpen) service.stdin_open = true;
  if (config.tty) service.tty = true;
  if (config.labels.length) service.labels = config.labels;
  if (config.extraHosts.length) service.extra_hosts = config.extraHosts;

  const compose = { services: { [serviceName]: service } };
  const yaml = window.jsyaml.dump(compose, {
    lineWidth: 120,
    noRefs: true,
  });

  if (config.detach) {
    config.notes.push("docker run -d maps to docker compose up -d, not a compose key.");
  }
  if (config.rm) {
    config.notes.push("docker run --rm is not a compose key. Use docker compose run --rm.");
  }
  if (config.unknown.length) {
    config.notes.push(`Unsupported flags: ${config.unknown.join(", ")}`);
  }

  return { output: yaml.trim(), notes: config.notes };
}

function handleComposeToRun() {
  const text = composeInput.value.trim();
  if (!text) {
    setStatus(statusConvert, "Paste a Compose file to convert.", "error");
    setOutput(outputConvert, "");
    setNotes(notesConvert, []);
    return;
  }
  try {
    const result = composeToRun(text);
    setOutput(outputConvert, result.output);
    setNotes(notesConvert, result.notes);
    setStatus(statusConvert, "Converted Compose to docker run.", "success");
  } catch (error) {
    setStatus(statusConvert, error.message, "error");
    setOutput(outputConvert, "");
    setNotes(notesConvert, []);
  }
}

function handleRunToCompose() {
  const text = runInput.value.trim();
  if (!text) {
    setStatus(statusConvert, "Paste a docker run command to convert.", "error");
    setOutput(outputConvert, "");
    setNotes(notesConvert, []);
    return;
  }
  try {
    const result = runToCompose(text);
    setOutput(outputConvert, result.output);
    setNotes(notesConvert, result.notes);
    setStatus(statusConvert, "Converted docker run to Compose.", "success");
  } catch (error) {
    setStatus(statusConvert, error.message, "error");
    setOutput(outputConvert, "");
    setNotes(notesConvert, []);
  }
}

// Dockerfile builder
const dfBase = document.getElementById("dfBase");
const dfWorkdir = document.getElementById("dfWorkdir");
const dfCopy = document.getElementById("dfCopy");
const dfRun = document.getElementById("dfRun");
const dfEnv = document.getElementById("dfEnv");
const dfExpose = document.getElementById("dfExpose");
const dfEntrypoint = document.getElementById("dfEntrypoint");
const dfCmd = document.getElementById("dfCmd");
const dfOutput = document.getElementById("dfOutput");
const dfStatus = document.getElementById("dfStatus");
const dfNotes = document.getElementById("dfNotes");

function buildDockerfile() {
  const base = dfBase.value.trim();
  if (!base) {
    setStatus(dfStatus, "Base image is required.", "error");
    setOutput(dfOutput, "");
    setNotes(dfNotes, []);
    return;
  }
  const notes = [];
  const output = [`FROM ${base}`];
  const workdir = dfWorkdir.value.trim();
  if (workdir) output.push(`WORKDIR ${workdir}`);

  lines(dfCopy.value).forEach((line) => {
    const parts = line.split(/\s+/).filter(Boolean);
    const src = parts.shift();
    const dest = parts.join(" ");
    if (!src) return;
    if (!dest) {
      notes.push(`COPY "${src}" had no destination. Using .`);
    }
    output.push(`COPY ${src} ${dest || "."}`);
  });

  lines(dfEnv.value).forEach((line) => {
    if (line.startsWith("#")) return;
    output.push(`ENV ${line}`);
  });

  lines(dfRun.value).forEach((line) => {
    output.push(`RUN ${line}`);
  });

  lines(dfExpose.value).forEach((line) => {
    output.push(`EXPOSE ${line}`);
  });

  const entry = dfEntrypoint.value.trim();
  if (entry) output.push(`ENTRYPOINT ${entry}`);

  const cmd = dfCmd.value.trim();
  if (cmd) output.push(`CMD ${cmd}`);

  setOutput(dfOutput, output.join("\n"));
  setNotes(dfNotes, notes);
  setStatus(dfStatus, "Dockerfile generated.", "success");
}

// docker run builder
const rbImage = document.getElementById("rbImage");
const rbName = document.getElementById("rbName");
const rbPorts = document.getElementById("rbPorts");
const rbEnv = document.getElementById("rbEnv");
const rbVolumes = document.getElementById("rbVolumes");
const rbRestart = document.getElementById("rbRestart");
const rbNetwork = document.getElementById("rbNetwork");
const rbWorkdir = document.getElementById("rbWorkdir");
const rbUser = document.getElementById("rbUser");
const rbEntrypoint = document.getElementById("rbEntrypoint");
const rbCommand = document.getElementById("rbCommand");
const rbDetach = document.getElementById("rbDetach");
const rbRm = document.getElementById("rbRm");
const rbPrivileged = document.getElementById("rbPrivileged");
const rbTty = document.getElementById("rbTty");
const rbInteractive = document.getElementById("rbInteractive");
const rbOutput = document.getElementById("rbOutput");
const rbStatus = document.getElementById("rbStatus");

function buildRunCommand() {
  const image = rbImage.value.trim();
  if (!image) {
    setStatus(rbStatus, "Image is required.", "error");
    setOutput(rbOutput, "");
    return;
  }
  const args = ["docker", "run"];

  if (rbDetach.checked) args.push("-d");
  if (rbRm.checked) args.push("--rm");
  if (rbPrivileged.checked) args.push("--privileged");
  if (rbTty.checked) args.push("-t");
  if (rbInteractive.checked) args.push("-i");

  const name = rbName.value.trim();
  if (name) args.push("--name", shellEscape(name));

  const restart = rbRestart.value;
  if (restart) args.push("--restart", shellEscape(restart));

  const network = rbNetwork.value.trim();
  if (network) args.push("--network", shellEscape(network));

  const workdir = rbWorkdir.value.trim();
  if (workdir) args.push("--workdir", shellEscape(workdir));

  const user = rbUser.value.trim();
  if (user) args.push("--user", shellEscape(user));

  const entrypoint = rbEntrypoint.value.trim();
  if (entrypoint) args.push("--entrypoint", shellEscape(entrypoint));

  lines(rbPorts.value).forEach((line) => args.push("-p", shellEscape(line)));
  lines(rbEnv.value).forEach((line) => args.push("-e", shellEscape(line)));
  lines(rbVolumes.value).forEach((line) => args.push("-v", shellEscape(line)));

  args.push(shellEscape(image));

  const command = rbCommand.value.trim();
  if (command) args.push(command);

  setOutput(rbOutput, args.join(" "));
  setStatus(rbStatus, "docker run command generated.", "success");
}

// Compose builder
const cbService = document.getElementById("cbService");
const cbImage = document.getElementById("cbImage");
const cbContainer = document.getElementById("cbContainer");
const cbPorts = document.getElementById("cbPorts");
const cbEnv = document.getElementById("cbEnv");
const cbVolumes = document.getElementById("cbVolumes");
const cbCommand = document.getElementById("cbCommand");
const cbEntrypoint = document.getElementById("cbEntrypoint");
const cbRestart = document.getElementById("cbRestart");
const cbNetwork = document.getElementById("cbNetwork");
const cbDepends = document.getElementById("cbDepends");
const cbWorkdir = document.getElementById("cbWorkdir");
const cbUser = document.getElementById("cbUser");
const cbTty = document.getElementById("cbTty");
const cbStdin = document.getElementById("cbStdin");
const cbOutput = document.getElementById("cbOutput");
const cbStatus = document.getElementById("cbStatus");

function buildComposeSnippet() {
  if (!window.jsyaml) {
    setStatus(cbStatus, "YAML parser missing.", "error");
    return;
  }
  const serviceName = cbService.value.trim();
  const image = cbImage.value.trim();
  if (!serviceName || !image) {
    setStatus(cbStatus, "Service name and image are required.", "error");
    setOutput(cbOutput, "");
    return;
  }

  const service = { image };
  const containerName = cbContainer.value.trim();
  if (containerName) service.container_name = containerName;

  const ports = lines(cbPorts.value);
  if (ports.length) service.ports = ports;

  const envLines = lines(cbEnv.value);
  if (envLines.length) service.environment = parseEnvLines(envLines);

  const volumes = lines(cbVolumes.value);
  if (volumes.length) service.volumes = volumes;

  const command = cbCommand.value.trim();
  if (command) service.command = command;

  const entrypoint = cbEntrypoint.value.trim();
  if (entrypoint) service.entrypoint = entrypoint;

  const restart = cbRestart.value;
  if (restart) service.restart = restart;

  const network = cbNetwork.value.trim();
  if (network) service.network_mode = network;

  const depends = lines(cbDepends.value);
  if (depends.length) service.depends_on = depends;

  const workdir = cbWorkdir.value.trim();
  if (workdir) service.working_dir = workdir;

  const user = cbUser.value.trim();
  if (user) service.user = user;

  if (cbTty.checked) service.tty = true;
  if (cbStdin.checked) service.stdin_open = true;

  const compose = { services: { [serviceName]: service } };
  const yaml = window.jsyaml.dump(compose, {
    lineWidth: 120,
    noRefs: true,
  });

  setOutput(cbOutput, yaml.trim());
  setStatus(cbStatus, "Compose snippet generated.", "success");
}

// Env converter
const envInput = document.getElementById("envInput");
const composeEnvInput = document.getElementById("composeEnvInput");
const envOutput = document.getElementById("envOutput");
const envStatus = document.getElementById("envStatus");

function envToCompose() {
  if (!window.jsyaml) {
    setStatus(envStatus, "YAML parser missing.", "error");
    return;
  }
  const envLines = lines(envInput.value).filter((line) => !line.startsWith("#"));
  if (!envLines.length) {
    setStatus(envStatus, "Provide .env values to convert.", "error");
    setOutput(envOutput, "");
    return;
  }
  const envObj = {};
  envLines.forEach((line) => {
    const idx = line.indexOf("=");
    if (idx === -1) {
      envObj[line] = null;
    } else {
      envObj[line.slice(0, idx)] = line.slice(idx + 1);
    }
  });

  const yaml = window.jsyaml.dump({ environment: envObj }, {
    lineWidth: 120,
    noRefs: true,
  });

  composeEnvInput.value = yaml.trim();
  setOutput(envOutput, yaml.trim());
  setStatus(envStatus, "Converted .env to Compose environment.", "success");
}

function composeToEnv() {
  if (!window.jsyaml) {
    setStatus(envStatus, "YAML parser missing.", "error");
    return;
  }
  const text = composeEnvInput.value.trim();
  if (!text) {
    setStatus(envStatus, "Provide a Compose environment block.", "error");
    setOutput(envOutput, "");
    return;
  }
  let doc;
  try {
    doc = window.jsyaml.load(text);
  } catch (error) {
    setStatus(envStatus, `YAML parse error: ${error.message}`, "error");
    setOutput(envOutput, "");
    return;
  }
  const envData = doc && doc.environment ? doc.environment : doc;
  if (!envData) {
    setStatus(envStatus, "No environment data found.", "error");
    setOutput(envOutput, "");
    return;
  }

  let envLines = [];
  if (Array.isArray(envData)) {
    envLines = envData;
  } else {
    envLines = Object.entries(envData).map(([key, value]) => {
      if (value === null || value === undefined) {
        return key;
      }
      return `${key}=${value}`;
    });
  }

  const output = envLines.join("\n");
  envInput.value = output;
  setOutput(envOutput, output);
  setStatus(envStatus, "Converted Compose environment to .env.", "success");
}

// Port explainer
const portInput = document.getElementById("portInput");
const portOutput = document.getElementById("portOutput");
const portStatus = document.getElementById("portStatus");

function explainPortLine(line) {
  const parts = line.split("/");
  const raw = parts[0];
  const protocol = parts[1] || "tcp";
  const segments = raw.split(":");

  if (segments.length === 1) {
    return `Container port ${segments[0]} published on a random host port (${protocol}).`;
  }
  if (segments.length === 2) {
    return `Host port ${segments[0]} forwards to container port ${segments[1]} over ${protocol}.`;
  }

  const hostIP = segments[0];
  const hostPort = segments[1];
  const containerPort = segments.slice(2).join(":");
  return `Host ${hostIP}:${hostPort} forwards to container port ${containerPort} over ${protocol}.`;
}

function explainPorts() {
  const portLines = lines(portInput.value);
  if (!portLines.length) {
    setStatus(portStatus, "Add port mappings to explain.", "error");
    setOutput(portOutput, "");
    return;
  }
  const explanations = portLines.map(explainPortLine);
  setOutput(portOutput, explanations.join("\n"));
  setStatus(portStatus, "Explained port mappings.", "success");
}

// Volume helper
const volType = document.getElementById("volType");
const volSource = document.getElementById("volSource");
const volTarget = document.getElementById("volTarget");
const volMode = document.getElementById("volMode");
const volOutput = document.getElementById("volOutput");
const volNotes = document.getElementById("volNotes");
const volStatus = document.getElementById("volStatus");

function buildVolumeMount() {
  const type = volType.value;
  const source = volSource.value.trim();
  const target = volTarget.value.trim();
  const mode = volMode.value;
  const notes = [];

  if (!target) {
    setStatus(volStatus, "Target path is required.", "error");
    setOutput(volOutput, "");
    setNotes(volNotes, []);
    return;
  }

  if (type !== "anonymous" && !source) {
    setStatus(volStatus, "Source is required for bind or named volumes.", "error");
    setOutput(volOutput, "");
    setNotes(volNotes, []);
    return;
  }

  let mount = "";
  if (type === "anonymous") {
    mount = target;
    if (mode) {
      notes.push("Anonymous volumes ignore ro/rw in short form.");
    }
  } else {
    mount = `${source}:${target}${mode ? `:${mode}` : ""}`;
  }

  const output = [
    `docker run: -v ${mount}`,
    "compose:",
    "  volumes:",
    `    - ${mount}`,
  ].join("\n");

  if (type === "named") {
    notes.push("Remember to declare the named volume under top-level volumes.");
  }

  setOutput(volOutput, output);
  setNotes(volNotes, notes);
  setStatus(volStatus, "Volume entries generated.", "success");
}

// Image tag helper
const imgInput = document.getElementById("imgInput");
const imgOutput = document.getElementById("imgOutput");
const imgNotes = document.getElementById("imgNotes");
const imgStatus = document.getElementById("imgStatus");

function parseImageRef(text) {
  const input = text.trim();
  if (!input) return null;
  let ref = input;
  let digest = "";
  if (ref.includes("@")) {
    const parts = ref.split("@");
    ref = parts[0];
    digest = parts.slice(1).join("@");
  }

  let tag = "";
  const lastSlash = ref.lastIndexOf("/");
  const lastColon = ref.lastIndexOf(":");
  if (lastColon > lastSlash) {
    tag = ref.slice(lastColon + 1);
    ref = ref.slice(0, lastColon);
  }

  const segments = ref.split("/").filter(Boolean);
  let registry = "";
  let namespace = "";
  let repo = "";

  if (segments.length === 1) {
    repo = segments[0];
  } else {
    const first = segments[0];
    if (first.includes(".") || first.includes(":") || first === "localhost") {
      registry = first;
      segments.shift();
    }
    repo = segments.pop();
    namespace = segments.join("/");
  }

  return { registry, namespace, repo, tag, digest };
}

function analyzeImage() {
  const result = parseImageRef(imgInput.value);
  if (!result) {
    setStatus(imgStatus, "Provide an image reference.", "error");
    setOutput(imgOutput, "");
    setNotes(imgNotes, []);
    return;
  }
  const linesOut = [
    `Registry: ${result.registry || "(default)"}`,
    `Namespace: ${result.namespace || "(none)"}`,
    `Repository: ${result.repo || "(none)"}`,
    `Tag: ${result.tag || "(none)"}`,
    `Digest: ${result.digest || "(none)"}`,
  ];

  const notes = [];
  if (!result.registry) {
    notes.push("No registry specified; defaults to Docker Hub.");
  }
  if (!result.tag && !result.digest) {
    notes.push("No tag specified; Docker defaults to latest.");
  }
  if (result.tag === "latest") {
    notes.push("Avoid latest for reproducible builds.");
  }

  setOutput(imgOutput, linesOut.join("\n"));
  setNotes(imgNotes, notes);
  setStatus(imgStatus, "Image analyzed.", "success");
}

// Healthcheck builder
const healthCmd = document.getElementById("healthCmd");
const healthInterval = document.getElementById("healthInterval");
const healthTimeout = document.getElementById("healthTimeout");
const healthRetries = document.getElementById("healthRetries");
const healthStart = document.getElementById("healthStart");
const healthOutput = document.getElementById("healthOutput");
const healthStatus = document.getElementById("healthStatus");

function buildHealthcheck() {
  if (!window.jsyaml) {
    setStatus(healthStatus, "YAML parser missing.", "error");
    return;
  }
  const cmd = healthCmd.value.trim();
  if (!cmd) {
    setStatus(healthStatus, "Healthcheck command is required.", "error");
    setOutput(healthOutput, "");
    return;
  }

  const health = { test: ["CMD-SHELL", cmd] };
  const interval = normalizeDuration(healthInterval.value);
  const timeout = normalizeDuration(healthTimeout.value);
  const retries = healthRetries.value;
  const start = normalizeDuration(healthStart.value);

  if (interval) health.interval = interval;
  if (timeout) health.timeout = timeout;
  if (retries) health.retries = Number(retries);
  if (start) health.start_period = start;

  const compose = window.jsyaml.dump({ healthcheck: health }, { lineWidth: 120, noRefs: true }).trim();

  const runFlags = [
    `--health-cmd ${shellEscape(cmd)}`,
    interval ? `--health-interval ${interval}` : null,
    timeout ? `--health-timeout ${timeout}` : null,
    retries ? `--health-retries ${retries}` : null,
    start ? `--health-start-period ${start}` : null,
  ].filter(Boolean);

  const output = `Compose:\n${compose}\n\ndocker run flags:\n${runFlags.join(" ")}`;
  setOutput(healthOutput, output);
  setStatus(healthStatus, "Healthcheck generated.", "success");
}

// Network helper
const netService = document.getElementById("netService");
const netName = document.getElementById("netName");
const netAliases = document.getElementById("netAliases");
const netOutput = document.getElementById("netOutput");
const netStatus = document.getElementById("netStatus");

function buildNetworkSnippet() {
  if (!window.jsyaml) {
    setStatus(netStatus, "YAML parser missing.", "error");
    return;
  }
  const serviceName = netService.value.trim();
  const networkName = netName.value.trim();
  if (!serviceName || !networkName) {
    setStatus(netStatus, "Service name and network name are required.", "error");
    setOutput(netOutput, "");
    return;
  }

  const aliasLines = lines(netAliases.value);
  let serviceNetworks;
  if (aliasLines.length) {
    serviceNetworks = { [networkName]: { aliases: aliasLines } };
  } else {
    serviceNetworks = [networkName];
  }

  const compose = {
    services: {
      [serviceName]: {
        networks: serviceNetworks,
      },
    },
    networks: {
      [networkName]: {},
    },
  };

  const yaml = window.jsyaml.dump(compose, { lineWidth: 120, noRefs: true }).trim();
  setOutput(netOutput, yaml);
  setStatus(netStatus, "Network snippet generated.", "success");
}

// Formatter
const formatInput = document.getElementById("formatInput");
const formatOutput = document.getElementById("formatOutput");
const formatStatus = document.getElementById("formatStatus");

function parseAny(text) {
  if (!window.jsyaml) {
    throw new Error("YAML parser missing.");
  }
  try {
    return window.jsyaml.load(text);
  } catch (error) {
    try {
      return JSON.parse(text);
    } catch (jsonError) {
      throw error;
    }
  }
}

function formatAsYaml() {
  const text = formatInput.value.trim();
  if (!text) {
    setStatus(formatStatus, "Provide YAML or JSON to format.", "error");
    setOutput(formatOutput, "");
    return;
  }
  try {
    const doc = parseAny(text);
    const yaml = window.jsyaml.dump(doc, { lineWidth: 120, noRefs: true }).trim();
    setOutput(formatOutput, yaml);
    setStatus(formatStatus, "Formatted as YAML.", "success");
  } catch (error) {
    setStatus(formatStatus, `Parse error: ${error.message}`, "error");
    setOutput(formatOutput, "");
  }
}

function formatAsJson() {
  const text = formatInput.value.trim();
  if (!text) {
    setStatus(formatStatus, "Provide YAML or JSON to format.", "error");
    setOutput(formatOutput, "");
    return;
  }
  try {
    const doc = parseAny(text);
    const json = JSON.stringify(doc, null, 2);
    setOutput(formatOutput, json);
    setStatus(formatStatus, "Formatted as JSON.", "success");
  } catch (error) {
    setStatus(formatStatus, `Parse error: ${error.message}`, "error");
    setOutput(formatOutput, "");
  }
}

// Wire up events

document.getElementById("toRun").addEventListener("click", handleComposeToRun);
document.getElementById("toCompose").addEventListener("click", handleRunToCompose);
document.getElementById("copyOutput").addEventListener("click", () => copyOutput(outputConvert, statusConvert));

document.getElementById("composeClear").addEventListener("click", () => {
  composeInput.value = "";
  setStatus(statusConvert, "Compose cleared.", "info");
});

document.getElementById("runClear").addEventListener("click", () => {
  runInput.value = "";
  setStatus(statusConvert, "docker run cleared.", "info");
});

// Dockerfile events

document.getElementById("dfGenerate").addEventListener("click", buildDockerfile);
document.getElementById("dfCopyOutput").addEventListener("click", () => copyOutput(dfOutput, dfStatus));

document.getElementById("dfClear").addEventListener("click", () => {
  dfBase.value = "";
  dfWorkdir.value = "";
  dfCopy.value = "";
  dfRun.value = "";
  dfEnv.value = "";
  dfExpose.value = "";
  dfEntrypoint.value = "";
  dfCmd.value = "";
  setStatus(dfStatus, "Cleared.", "info");
});

// Run builder events

document.getElementById("rbGenerate").addEventListener("click", buildRunCommand);
document.getElementById("rbCopyOutput").addEventListener("click", () => copyOutput(rbOutput, rbStatus));

document.getElementById("rbClear").addEventListener("click", () => {
  rbImage.value = "";
  rbName.value = "";
  rbPorts.value = "";
  rbEnv.value = "";
  rbVolumes.value = "";
  rbRestart.value = "";
  rbNetwork.value = "";
  rbWorkdir.value = "";
  rbUser.value = "";
  rbEntrypoint.value = "";
  rbCommand.value = "";
  rbDetach.checked = false;
  rbRm.checked = false;
  rbPrivileged.checked = false;
  rbTty.checked = false;
  rbInteractive.checked = false;
  setStatus(rbStatus, "Cleared.", "info");
});

// Compose builder events

document.getElementById("cbGenerate").addEventListener("click", buildComposeSnippet);
document.getElementById("cbCopyOutput").addEventListener("click", () => copyOutput(cbOutput, cbStatus));

document.getElementById("cbClear").addEventListener("click", () => {
  cbService.value = "";
  cbImage.value = "";
  cbContainer.value = "";
  cbPorts.value = "";
  cbEnv.value = "";
  cbVolumes.value = "";
  cbCommand.value = "";
  cbEntrypoint.value = "";
  cbRestart.value = "";
  cbNetwork.value = "";
  cbDepends.value = "";
  cbWorkdir.value = "";
  cbUser.value = "";
  cbTty.checked = false;
  cbStdin.checked = false;
  setStatus(cbStatus, "Cleared.", "info");
});

// Env converter events

document.getElementById("envToCompose").addEventListener("click", envToCompose);
document.getElementById("composeToEnv").addEventListener("click", composeToEnv);
document.getElementById("envCopyOutput").addEventListener("click", () => copyOutput(envOutput, envStatus));

document.getElementById("envClear").addEventListener("click", () => {
  envInput.value = "";
  composeEnvInput.value = "";
  setStatus(envStatus, "Cleared.", "info");
});

// Port explainer events

document.getElementById("portExplain").addEventListener("click", explainPorts);
document.getElementById("portCopyOutput").addEventListener("click", () => copyOutput(portOutput, portStatus));

document.getElementById("portClear").addEventListener("click", () => {
  portInput.value = "";
  setStatus(portStatus, "Cleared.", "info");
});

// Volume helper events

document.getElementById("volGenerate").addEventListener("click", buildVolumeMount);
document.getElementById("volCopyOutput").addEventListener("click", () => copyOutput(volOutput, volStatus));

document.getElementById("volClear").addEventListener("click", () => {
  volType.value = "bind";
  volSource.value = "";
  volTarget.value = "";
  volMode.value = "";
  setStatus(volStatus, "Cleared.", "info");
  setNotes(volNotes, []);
});

// Image tag helper events

document.getElementById("imgAnalyze").addEventListener("click", analyzeImage);
document.getElementById("imgCopyOutput").addEventListener("click", () => copyOutput(imgOutput, imgStatus));

document.getElementById("imgClear").addEventListener("click", () => {
  imgInput.value = "";
  setStatus(imgStatus, "Cleared.", "info");
  setNotes(imgNotes, []);
});

// Healthcheck events

document.getElementById("healthGenerate").addEventListener("click", buildHealthcheck);
document.getElementById("healthCopyOutput").addEventListener("click", () => copyOutput(healthOutput, healthStatus));

document.getElementById("healthClear").addEventListener("click", () => {
  healthCmd.value = "";
  healthInterval.value = "";
  healthTimeout.value = "";
  healthRetries.value = "";
  healthStart.value = "";
  setStatus(healthStatus, "Cleared.", "info");
});

// Network helper events

document.getElementById("netGenerate").addEventListener("click", buildNetworkSnippet);
document.getElementById("netCopyOutput").addEventListener("click", () => copyOutput(netOutput, netStatus));

document.getElementById("netClear").addEventListener("click", () => {
  netService.value = "";
  netName.value = "";
  netAliases.value = "";
  setStatus(netStatus, "Cleared.", "info");
});

// Formatter events

document.getElementById("formatYaml").addEventListener("click", formatAsYaml);
document.getElementById("formatJson").addEventListener("click", formatAsJson);
document.getElementById("formatCopyOutput").addEventListener("click", () => copyOutput(formatOutput, formatStatus));

document.getElementById("formatClear").addEventListener("click", () => {
  formatInput.value = "";
  setStatus(formatStatus, "Cleared.", "info");
});

if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
}

applyTheme(resolveInitialTheme());
addHelpTooltips();

// Initialize outputs
setOutput(outputConvert, "");
setNotes(notesConvert, []);
setOutput(dfOutput, "");
setNotes(dfNotes, []);
setOutput(rbOutput, "");
setOutput(cbOutput, "");
setOutput(envOutput, "");
setOutput(portOutput, "");
setOutput(volOutput, "");
setNotes(volNotes, []);
setOutput(imgOutput, "");
setNotes(imgNotes, []);
setOutput(healthOutput, "");
setOutput(netOutput, "");
setOutput(formatOutput, "");
