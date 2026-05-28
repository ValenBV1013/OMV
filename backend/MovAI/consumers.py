import json
from channels.generic.websocket import AsyncWebsocketConsumer

class TrafficConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "traffic_alerts"

        # Join room group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Receive message from room group
    async def traffic_update(self, event):
        data = event["data"]

        # Send message to WebSocket
        await self.send(text_data=json.dumps(data))
