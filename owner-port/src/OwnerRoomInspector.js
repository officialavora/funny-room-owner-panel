import OwnerRoomLocks from './OwnerRoomLocks';
import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React, { useMemo, useState } from "react";
import {Alert,Image,StyleSheet,View} from 'react-native';
import { supabase } from "../lib/supabase";
const C = {
  panel: "#180F25",
  panel2: "#281B35",
  line: "#684974",
  text: "#F8F9FF",
  muted: "#8F99AF",
  purple: "#67407C",
  cyan: "#5FE5FF",
  gold: "#FFD76D",
  danger: "#FF5D82",
  green: "#55E4A0",
};
const DURATIONS = [
  ["1", "1H"],
  ["2", "2H"],
  ["5", "5H"],
  ["10", "10H"],
  ["24", "24H"],
  ["72", "3D"],
  ["168", "7D"],
  ["720", "30D"],
  ["permanent", "PERM"],
];
export default function OwnerRoomInspector({ onNotice }) {
  const [roomId, setRoomId] = useState(""),
    [room, setRoom] = useState(null),
    [reason, setReason] = useState("Owner room moderation"),
    [busy, setBusy] = useState(false),
    [kickHours, setKickHours] = useState("24");
  const notify = (x) => onNotice?.(x);
  const load = async () => {
    const id = Number(roomId);
    if (!id) return notify("Permanent Room ID required");
    setBusy(true);
    const { data, error } = await supabase.rpc("owner_lookup_room", {
      p_room_public_id: id,
    });
    setBusy(false);
    if (error) return notify(error.message);
    setRoom(data || null);
    if (data) notify(`Room ${id} loaded`);
  };
  const action = (kind, target = null) => {
    if (!room?.public_id) return;
    if(["kick","unblock"].includes(kind)&&kickHours!=="permanent"&&(!/^\d+$/.test(kickHours)||!Number.isSafeInteger(Number(kickHours))||Number(kickHours)<1))return notify("Enter positive whole hours or choose Permanent.");
    const duration =
      kickHours === "permanent"
        ? "permanent"
        : `${kickHours} hour${kickHours === "1" ? "" : "s"}`;
    const labels = {
      clear_chat: "Clear current room screen?",
      lock: "Lock room?",
      unlock: "Unlock room?",
      mute: "Mute this user?",
      unmute: "Unmute this user?",
      drop_seat: "Drop user from mic seat?",
      kick: `Block this user from the room for ${duration}?`,
      unblock: "Remove this room block?",
    };
    Alert.alert(
      labels[kind] || "Room action",
      `${room.name} • Room ${room.public_id}${target ? `\n${target.display_name || "Member"} • ID ${target.public_id}` : ""}\n\n${reason.trim() || "Owner moderation"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "CONFIRM",
          style: ["clear_chat", "kick", "lock"].includes(kind)
            ? "destructive"
            : "default",
          onPress: async () => {
            setBusy(true);
            const params = {
              p_room_public_id: Number(room.public_id),
              p_action: kind,
              p_target_public_id: target?.public_id || null,
              p_reason: reason.trim() || "Owner room moderation",
            };
            if (["kick", "unblock"].includes(kind))
              params.p_duration_hours =
                kickHours === "permanent" ? null : Number(kickHours);
            const { data, error } = await supabase.rpc(
              ["kick", "unblock"].includes(kind)
                ? "owner_room_access_action"
                : "owner_room_action",
              params,
            );
            setBusy(false);
            if (error) return notify(error.message);
            setRoom(data || room);
            notify(`Room action complete • ${kind.replaceAll("_", " ")}`);
          },
        },
      ],
    );
  };
  const seats = useMemo(() => {
    const count = Math.max(1, Number(room?.seat_count || 5));
    const members = room?.members || [];
    return Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      member: members.find((m) => Number(m.seat_number) === i + 1),
    }));
  }, [room]);
  const audience = (room?.members || []).filter((m) => !m.seat_number);
  const Member = ({ m }) => (
    <View style={s.member}>
      {m.avatar_url ? (
        <Image source={{ uri: m.avatar_url }} style={s.memberDp} />
      ) : (
        <View style={s.memberDp}>
          <Text>☺</Text>
        </View>
      )}
      <View style={s.flex}>
        <Text style={s.memberName}>
          {m.display_name || "Member"} • ID {m.public_id}
        </Text>
        <Text style={s.meta}>
          {String(m.role || "audience").toUpperCase()} •{" "}
          {m.seat_number ? `Seat ${m.seat_number}` : "Audience"} •{" "}
          {m.muted ? "Muted" : "Unmuted"}
        </Text>
      </View>
      <View style={s.memberActions}>
        <Pressable
          onPress={() => action(m.muted ? "unmute" : "mute", m)}
          style={s.mini}
        >
          <Text style={s.miniText}>{m.muted ? "UNMUTE" : "MUTE"}</Text>
        </Pressable>
        {m.seat_number ? (
          <Pressable onPress={() => action("drop_seat", m)} style={s.mini}>
            <Text style={s.miniText}>DROP</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => action("kick", m)} style={s.kick}>
          <Text style={s.kickText}>KICK</Text>
        </Pressable>
        <Pressable onPress={() => action("unblock", m)} style={s.unblock}>
          <Text style={s.unblockText}>UNBLOCK</Text>
        </Pressable>
      </View>
    </View>
  );
  return (
    <View style={s.wrap}><AiBackdrop opacity={.22}/>
      <Text style={s.title}>Room inspector • backend control</Text>
      <Text style={s.help}>
        Check every mic seat and audience member, then mute, unmute, drop,
        timed-kick, permanently block, or unblock.
      </Text>
      <View style={s.lookup}>
        <TextInput
          value={roomId}
          onChangeText={(x) => {
            setRoomId(x);
            if (room && String(room.public_id) !== x) setRoom(null);
          }}
          keyboardType="number-pad"
          placeholder="Permanent Room ID"
          placeholderTextColor="#737B8E"
          style={[s.input, s.flex]}
        />
        <Pressable disabled={busy} onPress={load} style={s.check}>
          <Text style={s.checkText}>{busy ? "…" : "CHECK"}</Text>
        </Pressable>
      </View>
      <TextInput
        value={reason}
        onChangeText={setReason}
        maxLength={500}
        placeholder="Moderation reason"
        placeholderTextColor="#737B8E"
        style={s.input}
      />
      {room ? (
        <>
          <View style={s.room}>
            <View style={s.roomDp}>
              {room.avatar_url ? (
                <Image source={{ uri: room.avatar_url }} style={s.img} />
              ) : (
                <Text style={{ fontSize: 23 }}>🎙️</Text>
              )}
            </View>
            <View style={s.flex}>
              <Text style={s.roomName}>{room.name}</Text>
              <Text style={s.meta}>
                Room {room.public_id} • {room.country_code || "GLOBAL"} •{" "}
                {room.member_count || 0} users
              </Text>
              <Text style={s.meta}>
                Owner ID {room.owner_public_id} •{" "}
                {room.is_locked ? "LOCKED" : "OPEN"} •{" "}
                {room.is_live ? "LIVE" : "OFFLINE"}
              </Text>
            </View>
          </View>
          <View style={s.actions}>
            <Pressable onPress={() => action("clear_chat")} style={s.danger}>
              <Text style={s.dangerText}>CLEAN SCREEN</Text>
            </Pressable>
            <Pressable
              onPress={() => action(room.is_locked ? "unlock" : "lock")}
              style={s.control}
            >
              <Text style={s.controlText}>
                {room.is_locked ? "UNLOCK ROOM" : "LOCK ROOM"}
              </Text>
            </Pressable>
          </View>
          <OwnerRoomLocks key={room.id} roomId={room.id} onChanged={load}/><Text style={s.section}>Kick / block duration</Text>
          <View style={s.duration}>
            {DURATIONS.map(([v, l]) => (
              <Pressable
                key={v}
                onPress={() => setKickHours(v)}
                style={[s.durationChip, kickHours === v && s.durationOn]}
              >
                <Text style={s.durationText}>{l}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={kickHours==="permanent"?"":kickHours} onChangeText={setKickHours} keyboardType="number-pad" placeholder="Manual kick / block hours" placeholderTextColor="#737B8E" style={s.input}/>
          <Text style={s.section}>Mic seats</Text>
          <View style={s.seatGrid}>
            {seats.map((x) => (
              <View key={x.number} style={[s.seat, x.member && s.seatOn]}>
                <Text style={s.seatNo}>MIC {x.number}</Text>
                {x.member ? (
                  <>
                    <Text style={s.seatName} numberOfLines={1}>
                      {x.member.display_name || "Member"}
                    </Text>
                    <Text style={s.seatMeta}>
                      ID {x.member.public_id} •{" "}
                      {x.member.muted ? "MUTED" : "LIVE"}
                    </Text>
                  </>
                ) : (
                  <Text style={s.emptySeat}>EMPTY</Text>
                )}
              </View>
            ))}
          </View>
          <Text style={s.section}>Audience • {audience.length}</Text>
          {audience.map((m) => (
            <Member key={m.user_id} m={m} />
          ))}
          {!audience.length ? (
            <Text style={s.empty}>No audience member.</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: {
    marginTop: 12,
    borderRadius: 19,
    backgroundColor: "#0E1220",
    borderWidth: 1,
    borderColor: '#684974',
    padding: 11,
  },
  title: { color: C.text, fontSize: 16, fontWeight: "900" },
  help: { color: C.muted, fontSize: 8, lineHeight: 14, marginTop: 4 },
  lookup: { flexDirection: "row", gap: 6 },
  input: {
    minHeight: 42,
    borderRadius: 11,
    backgroundColor: "#0D1019",
    borderWidth: 1,
    borderColor: '#684974',
    color: C.text,
    paddingHorizontal: 10,
    marginTop: 7,
  },
  flex: { flex: 1 },
  check: {
    minWidth: 68,
    borderRadius: 11,
    backgroundColor: '#67407C',
    alignItems: "center",
    justifyContent: "center",
    marginTop: 7,
  },
  checkText: { color: "#fff", fontSize: 7, fontWeight: "900" },
  room: {
    minHeight: 69,
    borderRadius: 16,
    backgroundColor: "#17132D",
    borderWidth: 1,
    borderColor: "#4B3CA0",
    padding: 9,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roomDp: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#29234C",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  img: { width: "100%", height: "100%" },
  roomName: { color: C.text, fontSize: 12, fontWeight: "900" },
  meta: { color: C.muted, fontSize: 7, lineHeight: 12, marginTop: 3 },
  actions: { flexDirection: "row", gap: 7, marginTop: 8 },
  danger: {
    flex: 1,
    minHeight: 39,
    borderRadius: 10,
    backgroundColor: "#4A202B",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: { color: C.danger, fontSize: 7, fontWeight: "900" },
  control: {
    flex: 1,
    minHeight: 39,
    borderRadius: 10,
    backgroundColor: '#281B35',
    alignItems: "center",
    justifyContent: "center",
  },
  controlText: { color: C.cyan, fontSize: 7, fontWeight: "900" },
  section: {
    color: C.text,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 13,
    marginBottom: 5,
  },
  duration: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  durationChip: {
    width: "18.5%",
    minHeight: 31,
    borderRadius: 9,
    backgroundColor: '#281B35',
    alignItems: "center",
    justifyContent: "center",
  },
  durationOn: {
    backgroundColor: "#5039BB",
    borderWidth: 1,
    borderColor: C.gold,
  },
  durationText: { color: C.text, fontSize: 6, fontWeight: "900" },
  seatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  seat: {
    width: "31.8%",
    minHeight: 63,
    borderRadius: 12,
    backgroundColor: "#281B35",
    borderWidth: 1,
    borderColor: '#684974',
    padding: 7,
  },
  seatOn: { backgroundColor: "#1B2140", borderColor: '#67407C' },
  seatNo: { color: C.cyan, fontSize: 6, fontWeight: "900" },
  seatName: { color: C.text, fontSize: 8, fontWeight: "900", marginTop: 8 },
  seatMeta: { color: C.gold, fontSize: 5.5, marginTop: 3 },
  emptySeat: { color: C.muted, fontSize: 7, fontWeight: "900", marginTop: 12 },
  member: {
    minHeight: 70,
    borderTopWidth: 1,
    borderTopColor: '#684974',
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  memberDp: {
    width: 41,
    height: 41,
    borderRadius: 13,
    backgroundColor: "#29234C",
    alignItems: "center",
    justifyContent: "center",
  },
  memberName: { color: C.text, fontSize: 8, fontWeight: "900" },
  memberActions: { gap: 3 },
  mini: {
    minWidth: 48,
    minHeight: 24,
    borderRadius: 7,
    backgroundColor: "#263044",
    alignItems: "center",
    justifyContent: "center",
  },
  miniText: { color: C.cyan, fontSize: 5, fontWeight: "900" },
  kick: {
    minWidth: 48,
    minHeight: 24,
    borderRadius: 7,
    backgroundColor: "#3A1E29",
    alignItems: "center",
    justifyContent: "center",
  },
  kickText: { color: C.danger, fontSize: 5, fontWeight: "900" },
  unblock: {
    minWidth: 48,
    minHeight: 24,
    borderRadius: 7,
    backgroundColor: "#17392D",
    alignItems: "center",
    justifyContent: "center",
  },
  unblockText: { color: C.green, fontSize: 5, fontWeight: "900" },
  empty: {
    color: C.muted,
    fontSize: 8,
    textAlign: "center",
    paddingVertical: 15,
  },
});

