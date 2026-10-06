import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
const statusOf = (r) =>
  r.event_action ||
  (r.active &&
  (r.expires_at === null || new Date(r.expires_at).getTime() > Date.now())
    ? "ACTIVE"
    : r.revoked_at
      ? "UNLOCKED"
      : "EXPIRED");

export default function OwnerBanCenter({ onNotice, initialPublicId = "" }) {
  const [open, setOpen] = useState(Boolean(initialPublicId)),
    [type, setType] = useState("account"),
    [target, setTarget] = useState(String(initialPublicId || "")),
    [hours, setHours] = useState("24"),
    [reason, setReason] = useState("Safety moderation"),
    [rows, setRows] = useState([]),
    [busy, setBusy] = useState(false),
    [locked, setLocked] = useState(false);
  const [view, setView] = useState("active"),
    [query, setQuery] = useState(""),
    [checked, setChecked] = useState(null);
  const notify = (x) => onNotice?.(x);
  const refresh = useCallback(async () => {
    setBusy(true);
    const call =
      view === "active"
        ? supabase.rpc("owner_active_bans", { p_limit: 300 })
        : supabase.rpc("owner_ban_timeline_v2", { p_limit: 500 });
    const { data, error } = await call;
    setBusy(false);
    if (error) {
      setLocked(true);
      return;
    }
    setLocked(false);
    setRows(data || []);
  }, [view]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.target_display,
        r.target_type,
        r.reason,
        r.created_by_name,
        r.created_by_public_id,
        r.revoked_by_name,
        r.revoked_by_public_id,
        r.actor_name,
        r.actor_public_id,
        r.event_action,
        statusOf(r),
      ].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [rows, query]);
  if (locked) return null;
  const duration = () =>
    hours === "permanent"
      ? null
      : Math.max(1, Math.min(87600, Math.floor(Number(hours) || 0)));
  const checkTarget = async () => {
    if (!["account", "dp", "typing", "emoji", "message", "all", "room"].includes(type)) return;
    const id = Number(target);
    if (!Number.isSafeInteger(id)) return notify("Valid permanent ID required");
    setBusy(true);
    const { data, error } =
      type !== "room"
        ? await supabase.rpc("lookup_transaction_recipient", {
            p_public_id: id,
            p_require_seller: false,
          })
        : await supabase.rpc("owner_lookup_room", { p_room_public_id: id });
    setBusy(false);
    if (error) {
      setChecked(null);
      return notify(error.message);
    }
    setChecked(data || null);
    notify(`${type === "room" ? "Room" : "User"} checked • ID ${id}`);
  };
  const create = () => {
    const clean = target.trim();
    if (!clean) return notify("Ban target required");
    if (reason.trim().length < 3) return notify("Ban reason required");
    const h = duration();
    if (hours !== "permanent" && !h)
      return notify("Valid ban duration required");
    Alert.alert(
      "Apply restriction?",
      `${type.toUpperCase()} • ${clean}\nDuration: ${h === null ? "PERMANENT" : `${h} hours`}\nReason: ${reason.trim()}\n\nIf an active ban already exists, it will be updated instead of duplicated.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "BAN / UPDATE",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.rpc("owner_create_access_ban", {
              p_target_type: type,
              p_target_value: clean,
              p_duration_hours: h,
              p_reason: reason.trim(),
            });
            setBusy(false);
            if (error) return notify(error.message);
            setTarget("");
            notify(`${type} restriction active`);
            setView("active");
            await refresh();
          },
        },
      ],
    );
  };
  const revoke = (row) =>
    Alert.alert(
      "Unban / restore?",
      `${row.target_type.toUpperCase()} • ${row.target_display}\n${row.reason || ""}`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "UNBAN",
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.rpc("owner_revoke_access_ban", {
              p_ban: row.id,
              p_reason: "Owner manual unban",
            });
            setBusy(false);
            if (error) return notify(error.message);
            notify("Restriction removed");
            await refresh();
          },
        },
      ],
    );
  return (
    <View style={s.wrap}><AiBackdrop opacity={.22}/>
      <Pressable onPress={() => setOpen((v) => !v)} style={s.head}>
        <View>
          <Text style={s.title}>Ban / Unban center</Text>
          <Text style={s.meta}>
            ID • Room • Device • IP • searchable record
          </Text>
        </View>
        <Text style={s.arrow}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <>
          <View style={s.viewTabs}>
            <Pressable
              onPress={() => setView("active")}
              style={[s.viewTab, view === "active" && s.viewOn]}
            >
              <Text style={s.viewText}>ACTIVE</Text>
            </Pressable>
            <Pressable
              onPress={() => setView("history")}
              style={[s.viewTab, view === "history" && s.viewOn]}
            >
              <Text style={s.viewText}>BAN RECORD</Text>
            </Pressable>
          </View>
          {view === "active" ? (
            <>
              <View style={s.tabs}>
                {[
                  ["all", "ALL BAN"],
                  ["account", "USER ID"],
                  ["dp", "DP"],
                  ["typing", "TYPING"],
                  ["emoji", "EMOJI"],
                  ["message", "MESSAGE"],
                  ["room", "ROOM"],
                  ["device", "DEVICE"],
                  ["ip", "IP"],
                ].map(([v, l]) => (
                  <Pressable
                    key={v}
                    onPress={() => {
                      setType(v);
                      setTarget("");
                      setChecked(null);
                    }}
                    style={[s.tab, type === v && s.tabOn]}
                  >
                    <Text style={s.tabText}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={s.lookupRow}>
                <TextInput
                  value={target}
                  onChangeText={(x) => {
                    setTarget(x);
                    setChecked(null);
                  }}
                  keyboardType={
                    ["account", "dp", "typing", "emoji", "message", "all", "room"].includes(type)
                      ? "number-pad"
                      : "default"
                  }
                  autoCapitalize="none"
                  placeholder={
                    ["account", "dp", "typing", "emoji", "message", "all"].includes(type)
                      ? "Permanent user ID"
                      : type === "room"
                        ? "Permanent Room ID"
                        : type === "device"
                          ? "Device identifier / fingerprint"
                          : "IP address"
                  }
                  placeholderTextColor="#737B8E"
                  style={[s.input, s.lookupInput]}
                />
                {["account", "dp", "typing", "emoji", "message", "all", "room"].includes(type) ? (
                  <Pressable
                    disabled={busy}
                    onPress={checkTarget}
                    style={s.check}
                  >
                    <Text style={s.checkText}>CHECK</Text>
                  </Pressable>
                ) : null}
              </View>
              {checked ? (
                <View style={s.checked}>
                  {checked.avatar_url ? (
                    <Image source={{ uri: checked.avatar_url }} style={s.dp} />
                  ) : (
                    <View style={s.dp} />
                  )}
                  <View style={s.flex}>
                    <Text style={s.rowTitle}>
                      {checked.display_name || checked.name || "Member"}
                    </Text>
                    <Text style={s.meta}>ID {checked.public_id || target}</Text>
                  </View>
                  <Text style={s.checkedMark}>✓</Text>
                </View>
              ) : null}
              <View style={s.duration}>
                {[
                  ["24", "24H"],
                  ["72", "3D"],
                  ["168", "7D"],
                  ["720", "30D"],
                  ["permanent", "PERM"],
                ].map(([v, l]) => (
                  <Pressable
                    key={v}
                    onPress={() => setHours(v)}
                    style={[s.durationBtn, hours === v && s.durationOn]}
                  >
                    <Text style={s.durationText}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={hours}
                onChangeText={setHours}
                editable={hours !== "permanent"}
                keyboardType="number-pad"
                placeholder="Manual hours"
                placeholderTextColor="#737B8E"
                style={s.input}
              />
              <TextInput
                value={reason}
                onChangeText={setReason}
                maxLength={500}
                placeholder="Reason"
                placeholderTextColor="#737B8E"
                style={s.input}
              />
              <Pressable disabled={busy} onPress={create} style={s.ban}>
                <Text style={s.banText}>
                  {busy ? "WAIT…" : "BAN / UPDATE RESTRICTION"}
                </Text>
              </Pressable>
            </>
          ) : null}
          <View style={s.listHead}>
            <Text style={s.section}>
              {view === "active" ? "Active restrictions" : "Ban record"}
            </Text>
            <Pressable onPress={refresh}>
              <Text style={s.refresh}>{busy ? "…" : "Refresh"}</Text>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            placeholder="Search ID / room / reason / admin / status"
            placeholderTextColor="#737B8E"
            style={s.search}
          />
          {filtered.map((r) => {
            const st = statusOf(r);
            return (
              <View key={r.id} style={s.row}>
                <View style={s.flex}>
                  <View style={s.rowTop}>
                    <Text style={s.rowTitle}>
                      {String(r.target_type).toUpperCase()} •{" "}
                      {r.target_display || "Protected target"}
                    </Text>
                    <Text
                      style={[
                        s.status,
                        st === "ACTIVE"
                          ? s.statusActive
                          : st === "UNLOCKED"
                            ? s.statusUnlocked
                            : s.statusExpired,
                      ]}
                    >
                      {st}
                    </Text>
                  </View>
                  <Text style={s.meta}>{r.reason || "Safety restriction"}</Text>
                  <Text style={s.meta}>
                    {r.event_action ? `${r.event_action} ${r.action_number ? `#${r.action_number}` : ""}` : "Started"}{" "}
                    {new Date(r.occurred_at || r.created_at).toLocaleString()} • by{" "}
                    {r.actor_name || r.created_by_name || "Admin"}
                    {r.actor_public_id || r.created_by_public_id
                      ? ` (ID ${r.actor_public_id || r.created_by_public_id})`
                      : ""}
                  </Text>
                  {r.expires_at ? (
                    <Text style={s.meta}>
                      Expiry {new Date(r.expires_at).toLocaleString()}
                    </Text>
                  ) : (
                    <Text style={s.meta}>Permanent restriction</Text>
                  )}
                  {r.revoked_at ? (
                    <Text style={s.meta}>
                      Unlocked {new Date(r.revoked_at).toLocaleString()}
                      {r.revoked_by_name ? ` • by ${r.revoked_by_name}` : ""}
                    </Text>
                  ) : null}
                </View>
                {view === "active" && st === "ACTIVE" ? (
                  <Pressable
                    disabled={busy}
                    onPress={() => revoke(r)}
                    style={s.unban}
                  >
                    <Text style={s.unbanText}>UNBAN</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {!filtered.length ? (
            <Text style={s.empty}>
              {query
                ? "No matching ban record."
                : view === "active"
                  ? "No active restriction in your authority scope."
                  : "No ban history in your authority scope."}
            </Text>
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
    padding: 10,
  },
  head: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: C.text, fontSize: 15, fontWeight: "900" },
  meta: { color: C.muted, fontSize: 7, lineHeight: 12, marginTop: 3 },
  arrow: { color: C.gold, fontSize: 9, fontWeight: "900" },
  viewTabs: { flexDirection: "row", gap: 6, marginTop: 7 },
  viewTab: {
    flex: 1,
    minHeight: 36,
    borderRadius: 11,
    backgroundColor: '#281B35',
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: '#684974',
  },
  viewOn: { backgroundColor: "#2C2556", borderColor: '#67407C' },
  viewText: { color: C.text, fontSize: 7, fontWeight: "900" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  tab: {
    width: "31.8%",
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#281B35',
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: "#5039BB", borderWidth: 1, borderColor: C.gold },
  tabText: { color: C.text, fontSize: 6, fontWeight: "900" },
  lookupRow: { flexDirection: "row", gap: 6, alignItems: "stretch" },
  lookupInput: { flex: 1 },
  check: { minWidth: 68, borderRadius: 11, backgroundColor: '#67407C', alignItems: "center", justifyContent: "center", marginTop: 7 },
  checkText: { color: "#fff", fontSize: 7, fontWeight: "900" },
  checked: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 12, backgroundColor: "#171C29", borderWidth: 1, borderColor: "#34405A", marginTop: 7 },
  dp: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#29234C" },
  checkedMark: { color: C.green, fontSize: 18, fontWeight: "900" },
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
  search: {
    minHeight: 40,
    borderRadius: 11,
    backgroundColor: "#0B0F17",
    borderWidth: 1,
    borderColor: "#30384D",
    color: C.text,
    paddingHorizontal: 10,
    marginTop: 7,
    fontSize: 9,
  },
  duration: { flexDirection: "row", gap: 5, marginTop: 7 },
  durationBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    backgroundColor: '#281B35',
    alignItems: "center",
    justifyContent: "center",
  },
  durationOn: {
    backgroundColor: "#3A2436",
    borderWidth: 1,
    borderColor: C.danger,
  },
  durationText: { color: C.text, fontSize: 6, fontWeight: "900" },
  ban: {
    minHeight: 42,
    borderRadius: 11,
    backgroundColor: "#5A2330",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  banText: { color: "#FFD5DC", fontSize: 7, fontWeight: "900" },
  listHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 13,
  },
  section: { color: C.text, fontSize: 12, fontWeight: "900" },
  refresh: { color: C.cyan, fontSize: 7, fontWeight: "900" },
  row: {
    minHeight: 76,
    borderTopWidth: 1,
    borderTopColor: '#684974',
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  flex: { flex: 1 },
  rowTitle: { color: C.text, fontSize: 8, fontWeight: "900", flex: 1 },
  status: {
    fontSize: 6,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusActive: { color: "#B8FFD9", backgroundColor: "#17392D" },
  statusUnlocked: { color: "#BCEBFF", backgroundColor: "#173142" },
  statusExpired: { color: "#D0D5E1", backgroundColor: "#2A2F3A" },
  unban: {
    minWidth: 56,
    minHeight: 32,
    borderRadius: 9,
    backgroundColor: "#17392D",
    alignItems: "center",
    justifyContent: "center",
  },
  unbanText: { color: C.green, fontSize: 6, fontWeight: "900" },
  empty: {
    color: C.muted,
    fontSize: 8,
    textAlign: "center",
    paddingVertical: 16,
  },
});

