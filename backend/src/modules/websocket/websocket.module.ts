import { Module } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';

/**
 * WebSocket Module
 * Handles real-time communication
 */
@Module({
  providers: [WebSocketGateway],
  exports: [WebSocketGateway],
})
export class WebSocketModule {}

