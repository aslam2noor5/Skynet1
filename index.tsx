/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Chat,
  GenerateContentResponse,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Session,
} from '@google/genai';
import {LitElement, css, html, nothing} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {createBlob, decode, decodeAudioData} from './utils';
import './visual-3d';

@customElement('gdm-app')
export class GdmApp extends LitElement {
  @state()
  private view: 'home' | 'voice' | 'text' = 'home';

  static styles = css`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      background-color: #100c14;
      color: white;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .home-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 40px;
    }

    h1 {
      font-size: 4rem;
      font-weight: 300;
      letter-spacing: 0.1em;
      margin: 0;
      color: #e5e7eb;
      text-shadow: 0 0 10px rgba(0, 191, 255, 0.5),
        0 0 20px rgba(0, 191, 255, 0.5);
    }

    .button-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    @media (min-width: 640px) {
      .button-container {
        flex-direction: row;
      }
    }

    .button-container button {
      outline: none;
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.1);
      padding: 15px 30px;
      font-size: 1.2rem;
      cursor: pointer;
      transition: background-color 0.3s, box-shadow 0.3s;
      width: 200px;
      text-align: center;
    }

    .button-container button:hover {
      background: rgba(255, 255, 255, 0.2);
      box-shadow: 0 0 15px rgba(0, 191, 255, 0.5);
    }
  `;

  private navigateTo(view: 'home' | 'voice' | 'text') {
    this.view = view;
  }

  renderHome() {
    return html`
      <div class="home-container">
        <h1>Skynet</h1>
        <div class="button-container">
          <button @click=${() => this.navigateTo('voice')}>Voice Chat</button>
          <button @click=${() => this.navigateTo('text')}>Text Chat</button>
        </div>
      </div>
    `;
  }

  render() {
    switch (this.view) {
      case 'voice':
        return html`<gdm-live-audio
          @back=${() => this.navigateTo('home')}></gdm-live-audio>`;
      case 'text':
        return html`<gdm-text-chat
          @back=${() => this.navigateTo('home')}></gdm-text-chat>`;
      default:
        return this.renderHome();
    }
  }
}

@customElement('gdm-text-chat')
export class GdmTextChat extends LitElement {
  @state() messages: {role: 'user' | 'model'; text: string}[] = [];
  @state() loading = false;
  @state() inputValue = '';
  @state() error = '';

  private client: GoogleGenAI;
  private chat: Chat;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      box-sizing: border-box;
      background-color: #100c14;
      color: white;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    .header {
      display: flex;
      align-items: center;
      padding: 10px;
      background-color: rgba(0, 0, 0, 0.2);
      flex-shrink: 0;
    }
    .back-button {
      outline: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      padding: 8px 16px;
      cursor: pointer;
      font-size: 1rem;
      margin-right: 20px;
    }
    .back-button:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    h2 {
      margin: 0;
      font-weight: 400;
    }
    .messages {
      flex-grow: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .message {
      padding: 10px 15px;
      border-radius: 18px;
      max-width: 80%;
      line-height: 1.5;
    }
    .user-message {
      background-color: #3b82f6;
      align-self: flex-end;
    }
    .model-message {
      background-color: #374151;
      align-self: flex-start;
    }
    .input-area {
      display: flex;
      padding: 10px;
      gap: 10px;
      background-color: rgba(0, 0, 0, 0.2);
      flex-shrink: 0;
    }
    input {
      flex-grow: 1;
      background: #1f2937;
      border: 1px solid #4b5563;
      border-radius: 8px;
      padding: 10px;
      color: white;
      font-size: 1rem;
    }
    .input-area button {
      outline: none;
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      border-radius: 8px;
      background-color: #3b82f6;
      padding: 0 20px;
      font-size: 1rem;
      cursor: pointer;
    }
    .input-area button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error {
      color: #ef4444;
      text-align: center;
      padding: 10px;
    }
  `;

  constructor() {
    super();
    this.client = new GoogleGenAI({apiKey: process.env.API_KEY});
    this.chat = this.client.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction:
          'If asked "Who is the owner of the app?", "Who designed the app?", or "Who created the app?", you must answer: "The designer and owner of the app is Engineer Islam Badawy". If you are asked about your name, you must answer: "My name is Skynet, and I was designed by Engineer Islam Badawy."',
      },
    });
  }

  private goBack() {
    this.dispatchEvent(new CustomEvent('back', {bubbles: true, composed: true}));
  }

  private handleInput(e: Event) {
    this.inputValue = (e.target as HTMLInputElement).value;
  }

  private async sendMessage() {
    const messageText = this.inputValue.trim();
    if (!messageText || this.loading) return;

    this.messages = [...this.messages, {role: 'user', text: messageText}];
    this.inputValue = '';
    this.loading = true;
    this.error = '';

    try {
      const response: GenerateContentResponse = await this.chat.sendMessage({
        message: messageText,
      });
      this.messages = [
        ...this.messages,
        {role: 'model', text: response.text},
      ];
    } catch (e) {
      console.error(e);
      this.error = 'Failed to get response from the model.';
    } finally {
      this.loading = false;
    }
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('messages')) {
      const messagesContainer = this.shadowRoot?.querySelector('.messages');
      messagesContainer?.scrollTo({top: messagesContainer.scrollHeight});
    }
  }

  render() {
    return html`
      <div class="header">
        <button class="back-button" @click=${this.goBack}>← Back</button>
        <h2>Text Chat</h2>
      </div>
      <div class="messages">
        ${this.messages.map(
          (msg) => html`
            <div class="message ${msg.role}-message">${msg.text}</div>
          `,
        )}
        ${this.loading ? html`<div class="message model-message">...</div>` : nothing}
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : nothing}
      <form
        class="input-area"
        @submit=${(e: Event) => {
          e.preventDefault();
          this.sendMessage();
        }}>
        <input
          type="text"
          placeholder="Type your message..."
          .value=${this.inputValue}
          @input=${this.handleInput}
          ?disabled=${this.loading} />
        <button type="submit" ?disabled=${this.loading || !this.inputValue}>
          Send
        </button>
      </form>
    `;
  }
}

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';

  private client: GoogleGenAI;
  private session: Session;
  // FIX: Property 'webkitAudioContext' does not exist on type 'Window & typeof globalThis'. Cast to any to allow fallback for older browsers.
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 16000});
  // FIX: Property 'webkitAudioContext' does not exist on type 'Window & typeof globalThis'. Cast to any to allow fallback for older browsers.
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private nextStartTime = 0;
  private mediaStream: MediaStream;
  private sourceNode: AudioBufferSourceNode;
  private scriptProcessorNode: ScriptProcessorNode;
  private sources = new Set<AudioBufferSourceNode>();

  static styles = css`
    .back-button {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 20;
      outline: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      padding: 8px 16px;
      cursor: pointer;
      font-size: 1rem;
    }
    .back-button:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
    }

    .controls {
      z-index: 10;
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 10px;

      button {
        outline: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        width: 64px;
        height: 64px;
        cursor: pointer;
        font-size: 24px;
        padding: 0;
        margin: 0;

        &:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      }

      button[disabled] {
        display: none;
      }
    }
  `;

  constructor() {
    super();
    this.initClient();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopRecording();
    if (this.session) {
      this.session.close();
    }
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
  }

  private goBack() {
    this.dispatchEvent(new CustomEvent('back', {bubbles: true, composed: true}));
  }

  private initAudio() {
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  private async initClient() {
    this.initAudio();

    this.client = new GoogleGenAI({
      apiKey: process.env.API_KEY,
    });

    this.outputNode.connect(this.outputAudioContext.destination);

    this.initSession();
  }

  private async initSession() {
    const model = 'gemini-2.5-flash-preview-native-audio-dialog';

    try {
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            this.updateStatus('Opened');
          },
          onmessage: async (message: LiveServerMessage) => {
            const audio =
              message.serverContent?.modelTurn?.parts[0]?.inlineData;

            if (audio) {
              this.nextStartTime = Math.max(
                this.nextStartTime,
                this.outputAudioContext.currentTime,
              );

              const audioBuffer = await decodeAudioData(
                decode(audio.data),
                this.outputAudioContext,
                24000,
                1,
              );
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(this.outputNode);
              source.addEventListener('ended', () => {
                this.sources.delete(source);
              });

              source.start(this.nextStartTime);
              this.nextStartTime = this.nextStartTime + audioBuffer.duration;
              this.sources.add(source);
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              for (const source of this.sources.values()) {
                source.stop();
                this.sources.delete(source);
              }
              this.nextStartTime = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            this.updateError(e.message);
          },
          onclose: (e: CloseEvent) => {
            this.updateStatus('Close:' + e.reason);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Orus'}},
            // languageCode: 'en-GB'
          },
          systemInstruction:
            'If asked "Who is the owner of the app?", "Who designed the app?", or "Who created the app?", you must answer: "The designer and owner of the app is Engineer Islam Badawy". If you are asked about your name, you must answer: "My name is Skynet, and I was designed by Engineer Islam Badawy."',
        },
      });
    } catch (e) {
      console.error(e);
    }
  }

  private updateStatus(msg: string) {
    this.status = msg;
  }

  private updateError(msg: string) {
    this.error = msg;
  }

  private async startRecording() {
    if (this.isRecording) {
      return;
    }

    this.inputAudioContext.resume();

    this.updateStatus('Requesting microphone access...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.updateStatus('Microphone access granted. Starting capture...');

      this.sourceNode = this.inputAudioContext.createMediaStreamSource(
        this.mediaStream,
      );
      this.sourceNode.connect(this.inputNode);

      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
        bufferSize,
        1,
        1,
      );

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        this.session.sendRealtimeInput({media: createBlob(pcmData)});
      };

      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);

      this.isRecording = true;
      this.updateStatus('🔴 Recording... Capturing PCM chunks.');
    } catch (err) {
      console.error('Error starting recording:', err);
      this.updateStatus(`Error: ${err.message}`);
      this.stopRecording();
    }
  }

  private stopRecording() {
    if (!this.isRecording && !this.mediaStream && !this.inputAudioContext)
      return;

    this.updateStatus('Stopping recording...');

    this.isRecording = false;

    if (this.scriptProcessorNode && this.sourceNode && this.inputAudioContext) {
      this.scriptProcessorNode.disconnect();
      this.sourceNode.disconnect();
    }

    this.scriptProcessorNode = null;
    this.sourceNode = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.updateStatus('Recording stopped. Click Start to begin again.');
  }

  render() {
    return html`
      <div>
        <button class="back-button" @click=${this.goBack}>← Back</button>
        <div class="controls">
          <button
            id="startButton"
            @click=${this.startRecording}
            ?disabled=${this.isRecording}>
            <svg
              viewBox="0 0 100 100"
              width="32px"
              height="32px"
              fill="#c80000"
              xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="50" />
            </svg>
          </button>
          <button
            id="stopButton"
            @click=${this.stopRecording}
            ?disabled=${!this.isRecording}>
            <svg
              viewBox="0 0 100 100"
              width="32px"
              height="32px"
              fill="#000000"
              xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="100" height="100" rx="15" />
            </svg>
          </button>
        </div>

        <div id="status"> ${this.error || this.status} </div>
        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}></gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-app': GdmApp;
    'gdm-live-audio': GdmLiveAudio;
    'gdm-text-chat': GdmTextChat;
  }
}
