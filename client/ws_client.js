import {io} from './node_modules/socket.io-client/dist/socket.io.esm.min.js';

const socket = io('http://192.168.0.170:3000');

// --- DOM Element References ---
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messageContainer = document.getElementById('messageContainer');
// TTS Controls
const ttsControlsContainer = document.getElementById('tts-controls'); // Reference to the container div
const ttsEnableCheckbox = document.getElementById('tts-enable');
const ttsVoiceSelect = document.getElementById('tts-voice');
const ttsRateInput = document.getElementById('tts-rate');
const ttsPitchInput = document.getElementById('tts-pitch');
const ttsRateValueSpan = document.getElementById('tts-rate-value'); // Optional display
const ttsPitchValueSpan = document.getElementById('tts-pitch-value'); // Optional display
const ttsTestButton = document.getElementById('tts-test-button'); // Optional test button

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  // Use SameSite=Lax for better security and compatibility
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

// --- TTS Settings Persistence ---
const TTS_SETTINGS_COOKIE_NAME = 'ttsSettings';

function saveTTSSettings() {
  // Check if controls exist before trying to access their properties
  if (!ttsEnableCheckbox || !ttsVoiceSelect || !ttsRateInput || !ttsPitchInput) {
    console.warn("TTS controls not found, cannot save settings.");
    return;
  }
  const settings = {
    enabled: ttsEnableCheckbox.checked,
    // Store the voice NAME, as index might change if voices change
    voiceName: ttsVoiceSelect.selectedOptions[0]?.getAttribute('data-name') || null,
    rate: parseFloat(ttsRateInput.value) || 1,
    pitch: parseFloat(ttsPitchInput.value) || 1,
  };
  setCookie(TTS_SETTINGS_COOKIE_NAME, JSON.stringify(settings), 365); // Save for 1 year
  // console.log('TTS Settings Saved:', settings);
}

function loadTTSSettings() {
  const savedSettings = getCookie(TTS_SETTINGS_COOKIE_NAME);
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      // console.log('TTS Settings Loaded:', settings);

      // Apply settings to controls - Ensure controls exist before setting
      if (ttsEnableCheckbox) {
        ttsEnableCheckbox.checked = settings.enabled;
      }
      if (ttsRateInput) {
        ttsRateInput.value = settings.rate;
        if (ttsRateValueSpan) ttsRateValueSpan.textContent = settings.rate; // Update display span
      }
      if (ttsPitchInput) {
        ttsPitchInput.value = settings.pitch;
        if (ttsPitchValueSpan) ttsPitchValueSpan.textContent = settings.pitch; // Update display span
      }

      // Return the voice name to be used by populateVoiceList
      return settings.voiceName;

    } catch (e) {
      console.error('Error parsing saved TTS settings:', e);
      setCookie(TTS_SETTINGS_COOKIE_NAME, '', -1); // Clear corrupted cookie
      return null;
    }
  }
  return null; // No saved settings found
}
// --- End TTS Settings Persistence ---


// --- Text-to-Speech Setup ---
const synth = window.speechSynthesis;
let voices = []; // To store available voices
let loadedVoiceName = null; // Variable to hold voice name from cookie

// *** Call loadTTSSettings early to get the voice name ***
loadedVoiceName = loadTTSSettings();

function populateVoiceList() {
  if (typeof synth === 'undefined') {
    console.warn('Speech Synthesis not supported by this browser.');
    // Disable TTS controls if not supported and controls container exists
    if (ttsControlsContainer) {
      ttsControlsContainer.style.display = 'none';
    }
    return;
  }

  // Ensure the voice select dropdown exists before proceeding
  if (!ttsVoiceSelect) {
    console.error("TTS voice select dropdown not found.");
    return;
  }

  // Filter for English voices first, then sort
  voices = synth.getVoices()
      .filter(voice => voice.lang.startsWith('en'))
      .sort((a, b) => {
        const aName = a.name.toUpperCase();
        const bName = b.name.toUpperCase();
        if (aName < bName) return -1;
        if (aName > bName) return 1;
        return 0;
      });

  // --- Voice Selection Logic ---
  let voiceToSelect = -1; // Index of the voice to select in the dropdown

  // 1. Try to find the voice loaded from the cookie
  if (loadedVoiceName) {
    voiceToSelect = voices.findIndex(v => v.name === loadedVoiceName);
    if (voiceToSelect !== -1) {
      console.log(`Found saved voice "${loadedVoiceName}" at index ${voiceToSelect}`);
    } else {
      console.warn(`Saved voice "${loadedVoiceName}" not found in current list.`);
      loadedVoiceName = null; // Clear if not found, so default logic can run
    }
  }

  // 2. If no saved voice was found/loaded, try to find the default "by name" or "en-GB"
  if (voiceToSelect === -1) {
    //voiceToSelect = voices.findIndex(v => v.lang.startsWith('en-GB') && v.name.includes('Benjamin'));
    voiceToSelect = voices.findIndex(v => v.lang.startsWith('en-GB') && v.name.includes('David'));
    if (voiceToSelect !== -1) {
      console.log(`Found default voice at index ${voiceToSelect}`);
    } else {
      // Fallback: Find the *first* available en-GB voice
      voiceToSelect = voices.findIndex(v => v.lang.startsWith('en-GB'));
      if (voiceToSelect !== -1) {
        console.log(`Found first available default voice "en-GB" at index ${voiceToSelect}`);
      } else {
        console.log('Default en-GB voice not found, will use browser default (index 0).');
        voiceToSelect = 0; // Default to the first voice in the filtered list if no GB found
      }
    }
  }

  // --- Populate Dropdown ---
  ttsVoiceSelect.innerHTML = ''; // Clear previous options

  voices.forEach((voice, i) => {
    const option = document.createElement('option');
    option.textContent = `${voice.name} (${voice.lang})`;
    // Storing lang and name is still useful even if all are English variants
    option.setAttribute('data-lang', voice.lang);
    option.setAttribute('data-name', voice.name);
    ttsVoiceSelect.appendChild(option);
  });

  // --- Set the final selected index ---
  if (voiceToSelect >= 0 && voiceToSelect < voices.length) {
    ttsVoiceSelect.selectedIndex = voiceToSelect;
  } else if (voices.length > 0) {
    ttsVoiceSelect.selectedIndex = 0; // Fallback if something went wrong
  } else {
    // No English voices found at all
    console.warn("No English voices found for TTS.");
    // Optionally disable the voice select or show a message
    ttsVoiceSelect.disabled = true;
    const option = document.createElement('option');
    option.textContent = "No English voices available";
    ttsVoiceSelect.appendChild(option);
  }

  console.log('Available English voices populated:', voices.length);
}

// *** Initial population and event listener ***
populateVoiceList(); // Call it after defining
if (speechSynthesis.onvoiceschanged !== undefined) {
  // Repopulate AND try to re-apply saved/default selection when voices change
  speechSynthesis.onvoiceschanged = () => {
    console.log("Voices changed, repopulating list...");
    // Reload settings in case the previously saved voice is now available/unavailable
    // We need to re-read the cookie here in case the user changed settings
    // *before* the voiceschanged event fired.
    loadedVoiceName = loadTTSSettings();
    populateVoiceList();
    // After repopulating, save settings again in case the selected index changed
    // due to fallback logic if the saved/default voice disappeared.
    saveTTSSettings();
  };
}

/**
 * Speaks the given text using the Web Speech API, respecting UI settings.
 * @param {string} text - The text to be spoken.
 * @param {boolean} [isTest=false] - Flag to indicate if this is a test utterance.
 */
function speakText(text, isTest = false) {
  // 1. Check if TTS is enabled via checkbox (and controls exist)
  if (!isTest && (!ttsEnableCheckbox || !ttsEnableCheckbox.checked)) {
    return; // Exit if TTS is disabled (unless it's a test) or checkbox doesn't exist
  }

  if (!synth || !text) {
    console.warn('Speech synthesis not available or no text provided.');
    return; // Exit if synthesis not supported or text is empty
  }

  // Interrupt previous speech before starting new utterance
  if (synth.speaking) {
    console.log('SpeechSynthesis: interrupting previous speech.');
    synth.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.onend = () => {
    // console.log('SpeechSynthesisUtterance.onend');
  };

  utterance.onerror = (event) => {
    console.error('SpeechSynthesisUtterance.onerror', event);
  };

  // 2. Get selected voice from dropdown (ensure dropdown exists)
  if (ttsVoiceSelect && ttsVoiceSelect.selectedOptions.length > 0) {
    const selectedOption = ttsVoiceSelect.selectedOptions[0];
    const selectedVoiceName = selectedOption.getAttribute('data-name');
    if (selectedVoiceName) { // Check if data-name attribute exists
      const voice = voices.find(v => v.name === selectedVoiceName);
      if (voice) {
        utterance.voice = voice;
        // console.log('Using voice:', voice.name);
      } else {
        console.warn(`Selected voice "${selectedVoiceName}" not found in current list, using browser default.`);
      }
    } else {
      console.warn('Selected option has no data-name attribute, using browser default.');
    }
  } else {
    console.warn('No voice selected or dropdown not found, using browser default.');
  }

  // 3. Get rate and pitch from inputs (ensure inputs exist)
  utterance.rate = (ttsRateInput ? parseFloat(ttsRateInput.value) : 1) || 1;
  utterance.pitch = (ttsPitchInput ? parseFloat(ttsPitchInput.value) : 1) || 1;

  // console.log(`Speaking with Rate: ${utterance.rate}, Pitch: ${utterance.pitch}`);
  synth.speak(utterance);
}
// --- End Text-to-Speech Setup ---


// --- Event Listeners for TTS Controls ---

if (ttsEnableCheckbox) {
  ttsEnableCheckbox.addEventListener('change', saveTTSSettings); // Save on change
}
if (ttsVoiceSelect) {
  ttsVoiceSelect.addEventListener('change', saveTTSSettings); // Save on change
}

// Update display spans AND save settings when number inputs change
if (ttsRateInput) {
  ttsRateInput.addEventListener('input', () => {
    if (ttsRateValueSpan) ttsRateValueSpan.textContent = ttsRateInput.value;
    saveTTSSettings(); // Save on input change
  });
}
if (ttsPitchInput) {
  ttsPitchInput.addEventListener('input', () => {
    if (ttsPitchValueSpan) ttsPitchValueSpan.textContent = ttsPitchInput.value;
    saveTTSSettings(); // Save on input change
  });
}

// Optional: Test button functionality
if (ttsTestButton) {
  ttsTestButton.addEventListener('click', () => {
    const testText = "Testing the current voice settings.";
    speakText(testText, true); // Pass true to ignore the enable checkbox for testing
  });
}
// --- End Event Listeners for TTS Controls ---

if (messageForm) { // Check if form exists before adding listener
  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!messageInput) return; // Check if input exists

    const msg = messageInput.value.trim();
    if (msg) {
      socket.emit('aMessage', msg);
      messageInput.value = '';
    }
    messageInput.focus();
  });
} else {
  console.error("Message form not found.");
}

socket.on('aMessage', (msg) => {
  // Ensure message container exists
  if (!messageContainer) {
    console.error("Message container not found.");
    return;
  }

  // --- Create Message Elements ---
  const messageRow = document.createElement('div');
  const sendId = document.createElement('div');
  const messageBody = document.createElement('div');
  const timeStamp = document.createElement('div');

  sendId.className = 'sender';
  messageBody.className = 'message-text';
  timeStamp.className = 'timeStamp';
  messageRow.className = 'message';

  const senderShortId = msg.id ? msg.id.slice(-5) : 'Unknown'; // Handle missing ID
  sendId.textContent = senderShortId;
  sendId.style.color = generateHexColor(msg.id || 'default'); // Handle missing ID
  messageBody.textContent = msg.message || ''; // Handle missing message
  timeStamp.textContent = getTimestamp();

  messageRow.append(timeStamp, sendId, messageBody);
  messageContainer.appendChild(messageRow);

  // --- Speak the incoming message (respecting UI settings) ---
  const textToSpeak = msg.message || '';
  if (textToSpeak) { // Only speak if there's a message
    speakText(textToSpeak); // speakText now checks the enable checkbox internally
  }

  // --- Visual Feedback & Scroll ---
  messageRow.classList.add("highlight");
  setTimeout(() => {
    messageRow.classList.remove("highlight");
  }, 500);

  messageContainer.scrollTop = messageContainer.scrollHeight;
});

/**
 * Generates the current timestamp in "HH:MM" format.
 * @returns {string} The current time as a string (e.g., "14:05").
 */
function getTimestamp() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Generates a unique hexadecimal color code (#RRGGBB) based on a string ID.
 * Handles potentially missing IDs.
 * @param {string} id - The string identifier.
 * @returns {string} A hexadecimal color string (#RRGGBB).
 */
function generateHexColor(id = 'default') { // Provide a default ID
  let hash = 0;
  const strId = String(id); // Ensure it's a string
  for (let i = 0; i < strId.length; i++) {
    hash = strId.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  const r = (hash >> 16) & 0xff;
  const g = (hash >> 8) & 0xff;
  const b = hash & 0xff;
  const toHex = (c) => c.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}