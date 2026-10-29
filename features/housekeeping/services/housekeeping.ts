import { apiRequest } from "../../../lib/api/client";
import type {
  RoomNumber,
  RoomNumberList,
} from "../../rooms/services/room-numbers";

export type RoomStatusEvent = {
  id: string;
  roomUnitId?: string;
  roomNumber?: string;
  statusBefore: string;
  statusAfter: string;
  source: string;
  occurredAt: string;
  actorUserId: string;
  actorName: string;
};

export function listCleaningRooms(
  page: number,
  search: string,
  roomTypeId: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    page: String(page),
    limit: "20",
    operationalStatus: "cleaning",
    isActive: "true",
  });
  if (search) query.set("search", search);
  if (roomTypeId) query.set("roomTypeId", roomTypeId);
  return apiRequest<RoomNumberList>(`room-numbers?${query}`, { signal });
}
export function listRoomStatusHistory(id: string, signal?: AbortSignal) {
  return apiRequest<{ items: RoomStatusEvent[] }>(
    `room-numbers/${id}/status-history`,
    { signal },
  );
}
export function listRecentRoomStatusHistory(signal?: AbortSignal) {
  return apiRequest<{ items: RoomStatusEvent[] }>(
    "room-numbers/status-history",
    { signal },
  );
}
export function markRoomReady(room: RoomNumber) {
  return apiRequest<{ roomNumber: RoomNumber }>(
    `room-numbers/${room.id}/operational-status`,
    {
      method: "PATCH",
      body: { operationalStatus: "available", source: "housekeeping" },
    },
  );
}
