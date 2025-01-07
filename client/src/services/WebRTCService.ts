import { io, Socket } from "socket.io-client";
import { Users, UserInfo } from "../types/user";

export type ConnectionState = "disconnected" | "connecting" | "connected";

export class WebRTCService {
  private peerConnection: RTCPeerConnection;
  private socket: Socket;
  private dataChannel: RTCDataChannel | null = null;
  private messageHandler: ((message: string) => void) | null = null;
  private connectionStateHandler: ((state: ConnectionState) => void) | null =
    null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private currentRoomId: string | null = null;
  private usersHandler: ((users: Users) => void) | null = null;

  constructor() {
    this.socket = io("http://localhost:3001");
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.setupSocketListeners();
    this.setupPeerConnectionListeners();
    this.setupDataChannel();
    this.setupConnectionStateChange();
  }

  private setupSocketListeners() {
    this.socket.on("offer", async (offer) => {
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.socket.emit("answer", { answer, roomId: this.socket.id });
    });

    this.socket.on("answer", async (answer) => {
      await this.peerConnection.setRemoteDescription(answer);
    });

    this.socket.on("ice-candidate", async (candidate) => {
      await this.peerConnection.addIceCandidate(candidate);
    });

    this.socket.on("users", (users: Users) => {
      if (this.usersHandler) {
        this.usersHandler(users);
      }
    });
  }

  private setupPeerConnectionListeners() {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("ice-candidate", {
          candidate: event.candidate,
          roomId: this.socket.id,
        });
      }
    };
  }

  private setupDataChannel() {
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.initDataChannelListeners();
    };
  }

  private initDataChannelListeners() {
    if (!this.dataChannel) return;

    this.dataChannel.onmessage = (event) => {
      if (this.messageHandler) {
        this.messageHandler(event.data);
      }
    };
  }

  private setupConnectionStateChange() {
    this.peerConnection.onconnectionstatechange = () => {
      let state: ConnectionState = "disconnected";

      switch (this.peerConnection.connectionState) {
        case "connected":
          state = "connected";
          break;
        case "connecting":
        case "checking":
          state = "connecting";
          break;
        default:
          state = "disconnected";
      }

      if (this.connectionStateHandler) {
        this.connectionStateHandler(state);
      }
    };
  }

  onConnectionStateChange(handler: (state: ConnectionState) => void) {
    this.connectionStateHandler = handler;
  }

  private handleError(error: Error) {
    console.error("WebRTC Error:", error);
    if (this.connectionStateHandler) {
      this.connectionStateHandler("disconnected");
    }
  }

  async createRoom() {
    this.dataChannel = this.peerConnection.createDataChannel("messageChannel");
    this.initDataChannelListeners();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.socket.emit("offer", { offer, roomId: this.socket.id });
    return this.socket.id;
  }

  async joinRoom(roomId: string) {
    this.currentRoomId = roomId;
    this.socket.emit("join", roomId);
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handleError(new Error("최대 재연결 시도 횟수를 초과했습니다."));
      return false;
    }

    try {
      this.reconnectAttempts++;
      await this.resetConnection();
      if (this.currentRoomId) {
        await this.joinRoom(this.currentRoomId);
      }
      this.reconnectAttempts = 0;
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  private async resetConnection() {
    this.peerConnection.close();
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.setupPeerConnectionListeners();
    this.setupDataChannel();
    this.setupConnectionStateChange();
  }

  async sendMessage(message: string): Promise<boolean> {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      return false;
    }

    try {
      this.dataChannel.send(message);
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  onMessage(handler: (message: string) => void) {
    this.messageHandler = handler;
  }

  onUsers(handler: (users: Users) => void) {
    this.usersHandler = handler;
  }

  updateUserInfo(nickname: string, personalColor: string) {
    this.socket.emit("update_user_info", {
      nickname,
      personalColor,
      roomId: this.currentRoomId,
    });
  }
}
