import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React, { useCallback, useEffect, useRef, useState } from "react";
import {Alert,Image,ScrollView,StyleSheet,Switch,View} from 'react-native';
import { supabase } from "../lib/supabase";
import RuntimeControlCenter from "./RuntimeControlCenter";
import OwnerRewardOperationsCenter from "./OwnerRewardOperationsCenter";
import OwnerSafetyCenter from "./OwnerSafetyCenter";
import OwnerEmojiCatalog from './OwnerEmojiCatalog';
import OwnerGiftCatalog from "./OwnerGiftCatalog";
import OwnerCosmeticCatalog from "./OwnerCosmeticCatalog";
import OwnerAffinityPolicyCenter from "./OwnerAffinityPolicyCenter";
import OwnerSafeResetV3Center from "./OwnerSafeResetV3Center";
import OwnerLuckyGiftReversalCenter from "./OwnerLuckyGiftReversalCenter";
import { PREMIUM } from "./designSystem";

const C = {
  ...PREMIUM.colors,
  purple: PREMIUM.colors.violet,
  danger: PREMIUM.colors.rose,
};
const n = (v) => Number(v || 0).toLocaleString();
const TABS = [
  ["Runtime", "⚙️"],
  ["Safety", "🚨"],
  ["Roles", "📋"],
  ["Gifts", "🎁"],
  ["Cosmetics", "✦"],
  ["Reset & Recovery", "↩️"],
  ["Emoji", "😊"],
  ["Notice", "📢"],
  ["Rewards", "🏅"],
];

export default function OwnerPolicyCenter({ onNotice }) {
  const [tab, setTab] = useState("Runtime");
  const [noticeTool, setNoticeTool] = useState(null);
  const [luckyReversalCapability, setLuckyReversalCapability] = useState(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.rpc("load_my_lucky_gift_reversal_capability_v1");
      if (active) setLuckyReversalCapability(data || { can_view: false, can_execute: false });
    })();
    return () => { active = false; };
  }, []);
  const visibleTabs = luckyReversalCapability?.can_view
    ? [...TABS, ["Lucky Gift Reversal", "↩️"]]
    : TABS;
  const toggleNoticeTool = (tool) => setNoticeTool((current) => current === tool ? null : tool);
  return (
    <View style={s.wrap}><AiBackdrop opacity={.22}/>
      <Text style={s.mainTitle}>Owner Operations</Text>
      <Text style={s.help}>
        Choose a tool above. Manual grants, Vanity IDs and Campaign rewards are
        together in Rewards.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabs}
      >
        {visibleTabs.map(([x, i]) => (
          <Pressable
            key={x}
            onPress={() => setTab(x)}
            style={[s.tab, tab === x && s.tabOn]}
          >
            <Text style={s.tabIcon}>{i}</Text>
            <Text style={s.tabText}>{x}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {tab === "Runtime" ? (
        <RuntimeControlCenter />
      ) : tab === "Safety" ? (
        <OwnerSafetyCenter />
      ) : tab === "Roles" ? (
        <RoleReview />
      ) : tab === "Gifts" ? (
        <>
          <OwnerGiftCatalog />
          <OwnerCosmeticCatalog />
        </>
      ) : tab === "Cosmetics" ? (
        <OwnerCosmeticCatalog onNotice={onNotice} />
      ) : tab === "Reset & Recovery" ? (
        <OwnerSafeResetV3Center onNotice={onNotice} />
      ) : tab === "Emoji" ? (
        <OwnerEmojiCatalog onNotice={onNotice} />
      ) : tab === "Rewards" ? (
        <OwnerRewardOperationsCenter />
      ) : tab === "Lucky Gift Reversal" && luckyReversalCapability?.can_view ? (
        <OwnerLuckyGiftReversalCenter />
      ) : (
        <>
          <NoticePublisher activeTool={noticeTool} onOpenTool={toggleNoticeTool} />
          {noticeTool === "affinity" ? <OwnerAffinityPolicyCenter onNotice={onNotice} /> : null}
          {noticeTool === "reset" ? <OwnerSafeResetV3Center onNotice={onNotice} /> : null}
        </>
      )}
    </View>
  );
}

function RoomInspector() {
  const [roomId, setRoomId] = useState(""),
    [room, setRoom] = useState(null),
    [reason, setReason] = useState("Owner safety action"),
    [accessTarget, setAccessTarget] = useState(""),
    [kickHours, setKickHours] = useState("24"),
    [busy, setBusy] = useState(false);
  const load = async () => {
    if (!/^\d+$/.test(roomId.trim())) return Alert.alert("Room ID required");
    setBusy(true);
    const { data, error } = await supabase.rpc("owner_lookup_room", {
      p_room_public_id: Number(roomId),
    });
    setBusy(false);
    if (error) return Alert.alert("Room Inspector", error.message);
    if (!data) return Alert.alert("Room not found");
    setRoom(data);
  };
  const act = async (action, target = null) => {
    const run = async () => {
      setBusy(true);
      const { error } = await supabase.rpc("owner_room_action", {
        p_room_public_id: Number(room.public_id),
        p_action: action,
        p_target_public_id: target ? Number(target) : null,
        p_reason: reason.trim() || "Owner moderation",
      });
      setBusy(false);
      if (error) return Alert.alert("Room action", error.message);
      await load();
    };
    if (action === "clear_chat" || action === "kick")
      return Alert.alert(
        "Confirm action",
        action === "clear_chat"
          ? "Clear all current room messages?"
          : `Remove ID ${target} from room?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", style: "destructive", onPress: run },
        ],
      );
    return run();
  };
  const accessAction = async (targetPublicId, action) => {
    const target = String(targetPublicId || accessTarget).trim();
    if (!/^\d+$/.test(target)) return Alert.alert("Permanent user ID required");
    const hours = action === "kick" ? Number(kickHours) : 24;
    if (action === "kick" && (!Number.isInteger(hours) || hours < 1 || hours > 87600))
      return Alert.alert("Duration", "Enter 1–87600 hours");
    setBusy(true);
    const { error } = await supabase.rpc("owner_room_access_action", {
      p_room_public_id: Number(room.public_id),
      p_action: action,
      p_target_public_id: Number(target),
      p_duration_hours: hours,
      p_reason: reason.trim() || "Owner room moderation",
    });
    setBusy(false);
    if (error) return Alert.alert("Room access", error.message);
    setAccessTarget("");
    await load();
    Alert.alert("Room access", action === "kick" ? "User removed and blocked." : "User unblocked.");
  };
  return (
    <View>
      <Text style={s.section}>Global Room Inspector</Text>
      <View style={s.card}><AiBackdrop opacity={.22}/>
        <TextInput
          value={roomId}
          onChangeText={setRoomId}
          keyboardType="number-pad"
          placeholder="Room permanent ID"
          placeholderTextColor="#737B8E"
          style={s.input}
        />
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Reason"
          placeholderTextColor="#737B8E"
          style={s.input}
        />
        {room ? <>
          <TextInput value={accessTarget} onChangeText={setAccessTarget} keyboardType="number-pad" placeholder="User permanent ID for kick/unblock" placeholderTextColor="#737B8E" style={s.input} />
          <TextInput value={kickHours} onChangeText={setKickHours} keyboardType="number-pad" placeholder="Kick block duration in hours" placeholderTextColor="#737B8E" style={s.input} />
          <View style={s.actions}>
            <Pressable disabled={busy} onPress={()=>accessAction(null,"kick")} style={s.dangerButton}><Text style={s.dangerText}>KICK + BLOCK</Text></Pressable>
            <Pressable disabled={busy} onPress={()=>accessAction(null,"unblock")} style={s.secondary}><Text style={s.secondaryText}>UNBLOCK</Text></Pressable>
          </View>
        </> : null}
        <Pressable disabled={busy} onPress={load} style={s.primary}>
          <Text style={s.primaryText}>
            {busy ? "CHECKING…" : "OPEN ROOM PANEL"}
          </Text>
        </Pressable>
      </View>
      {room ? (
        <>
          <View style={s.roomHero}>
            {room.avatar_url ? (
              <Image source={{ uri: room.avatar_url }} style={s.roomAvatar} />
            ) : (
              <View style={s.roomAvatar}>
                <Text style={{ fontSize: 25 }}>🎙️</Text>
              </View>
            )}
            <View style={s.flex}>
              <Text style={s.rowTitle}>{room.name}</Text>
              <Text style={s.meta}>
                Room {room.public_id} • Owner {room.owner_name} / ID{" "}
                {room.owner_public_id}
              </Text>
              <Text style={s.meta}>
                {room.member_count} active • {room.is_live ? "LIVE" : "offline"}
              </Text>
            </View>
            <Pressable onPress={() => act("clear_chat")} style={s.dangerButton}>
              <Text style={s.dangerText}>CLEAN SCREEN</Text>
            </Pressable>
          </View>
          {(room.members || []).map((m) => (
            <View key={m.user_id} style={s.person}>
              <View style={s.flex}>
                <Text style={s.rowTitle}>
                  {m.display_name} • ID {m.public_id}
                </Text>
                <Text style={s.meta}>
                  {String(m.role).toUpperCase()}
                  {m.seat_number ? ` • Seat ${m.seat_number}` : ""}
                  {m.muted ? " • Muted" : ""}
                </Text>
              </View>
              <View style={s.miniActions}>
                <Pressable
                  onPress={() => act(m.muted ? "unmute" : "mute", m.public_id)}
                  style={s.mini}
                >
                  <Text style={s.miniText}>{m.muted ? "UNMUTE" : "MUTE"}</Text>
                </Pressable>
                {m.seat_number ? (
                  <Pressable
                    onPress={() => act("drop_seat", m.public_id)}
                    style={s.mini}
                  >
                    <Text style={s.miniText}>DROP</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => accessAction(m.public_id, "kick")}
                  style={[s.mini, s.miniDanger]}
                >
                  <Text style={s.dangerText}>KICK</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function BanCenter() {
  const [type, setType] = useState("account"),
    [value, setValue] = useState(""),
    [hours, setHours] = useState("24"),
    [reason, setReason] = useState("Owner moderation"),
    [rows, setRows] = useState([]),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("owner_active_bans", { p_limit: 150 });
    setRows(data || []);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const create = async () => {
    if (!value.trim()) return Alert.alert("Target required");
    const h = hours === "permanent" ? null : Number(hours);
    if (hours !== "permanent" && (!Number.isFinite(h) || h < 1))
      return Alert.alert("Duration", "Hours must be 1 or more");
    setBusy(true);
    const { error } = await supabase.rpc("owner_create_access_ban", {
      p_target_type: type,
      p_target_value: value.trim(),
      p_duration_hours: h,
      p_reason: reason.trim() || "Owner moderation",
    });
    setBusy(false);
    if (error) return Alert.alert("Restriction", error.message);
    setValue("");
    await refresh();
  };
  const revoke = async (row) => {
    setBusy(true);
    const { error } = await supabase.rpc("owner_revoke_access_ban", {
      p_ban: row.id,
      p_reason: "Owner manual unban",
    });
    setBusy(false);
    if (error) return Alert.alert("Unban", error.message);
    await refresh();
  };
  return (
    <View>
      <Text style={s.section}>Ban / Unban Center</Text>
      <View style={s.types}>
        {["account", "room", "device", "ip"].map((x) => (
          <Pressable
            key={x}
            onPress={() => setType(x)}
            style={[s.type, type === x && s.typeOn]}
          >
            <Text style={s.typeText}>{x.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.card}><AiBackdrop opacity={.22}/>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={
            type === "account"
              ? "Permanent user ID"
              : type === "room"
                ? "Room ID"
                : type === "ip"
                  ? "IP address"
                  : "Device ID"
          }
          placeholderTextColor="#737B8E"
          style={s.input}
        />
        <View style={s.types}>
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
              style={[s.type, hours === v && s.typeOn]}
            >
              <Text style={s.typeText}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={hours === "permanent" ? "" : hours}
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
          placeholder="Reason"
          placeholderTextColor="#737B8E"
          style={s.input}
        />
        <Pressable disabled={busy} onPress={create} style={s.block}>
          <Text style={s.blockText}>
            {busy ? "WORKING…" : "APPLY RESTRICTION"}
          </Text>
        </Pressable>
      </View>
      <Text style={s.section}>Active restrictions</Text>
      {rows.map((r) => (
        <View key={r.id} style={s.row}>
          <View style={s.flex}>
            <Text style={s.rowTitle}>
              {String(r.target_type).toUpperCase()} • {r.target_display}
            </Text>
            <Text style={s.meta}>
              {r.reason || "Restriction"} •{" "}
              {r.expires_at
                ? `until ${new Date(r.expires_at).toLocaleString()}`
                : "PERMANENT"}
            </Text>
          </View>
          <Pressable onPress={() => revoke(r)} style={s.unban}>
            <Text style={s.unbanText}>UNBAN</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function RoleReview() {
  const reviewLock=useRef(false);
  const [rows, setRows] = useState([]),
    [filter, setFilter] = useState("pending"),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(
    async (f = filter) => {
      const { data, error } = await supabase.rpc("owner_role_applications", {
        p_status: f,
        p_limit: 150,
      });
      if (!error) setRows(data || []);
    },
    [filter],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);
  const review = async (row, approve) => {
    if(reviewLock.current)return;
    reviewLock.current=true;setBusy(true);
    try {
      const {error}=await supabase.rpc("owner_review_role_application",{
        p_application:row.id,p_approve:approve,
        p_review_note:approve?"Approved after Owner review":"Rejected after Owner review",p_expires_at:null,
      });
      if(error)throw error;
      await refresh();
    }catch(error){Alert.alert("Role review",error.message||'Could not review this application. Please retry.');}
    finally{reviewLock.current=false;setBusy(false);}
  };
  return (
    <View>
      <Text style={s.section}>Role Applications</Text>
      <View style={s.types}>
        {["pending", "approved", "rejected", "all"].map((x) => (
          <Pressable
            key={x}
            onPress={() => {
              setFilter(x);
            }}
            style={[s.type, filter === x && s.typeOn]}
          >
            <Text style={s.typeText}>{x.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.id} style={s.row}>
          {r.avatar_url ? (
            <Image source={{ uri: r.avatar_url }} style={s.avatar} />
          ) : (
            <View style={s.avatar}>
              <Text>☺</Text>
            </View>
          )}
          <View style={s.flex}>
            <Text style={s.rowTitle}>
              {r.display_name} • ID {r.public_id}
            </Text>
            <Text style={s.meta}>
              {r.role_name} • {r.context_type}:{r.context_id}
            </Text>
            <Text style={s.meta}>{r.note || "No note"}</Text>
          </View>
          {r.status === "pending" ? (
            <View style={s.miniActions}>
              <Pressable
                disabled={busy}
                onPress={() => review(r, true)}
                style={s.approve}
              >
                <Text style={s.approveText}>✓</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => review(r, false)}
                style={s.reject}
              >
                <Text style={s.rejectText}>×</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={s.status}>{String(r.status).toUpperCase()}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function SalaryPolicy() {
  const [rows, setRows] = useState([]),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    const { data, error } = await supabase.rpc("owner_salary_policies");
    if (!error) setRows(data || []);
  };
  useEffect(() => {
    refresh();
  }, []);
  const save = async () => {
    const e = editing;
    if (!e) return;
    setBusy(true);
    const { error } = await supabase.rpc("owner_upsert_salary_policy", {
      p_role: e.role_key,
      p_target_units: Number(e.target_units || 0),
      p_salary_percent: Number(e.salary_percent || 0),
      p_advance_percent: Number(e.advance_percent || 0),
      p_cycle: e.cycle,
      p_active: Boolean(e.active),
    });
    setBusy(false);
    if (error) return Alert.alert("Salary policy", error.message);
    setEditing(null);
    await refresh();
  };
  return (
    <View>
      <Text style={s.section}>Target / Salary / Advance</Text>
      <Text style={s.help}>
        Policy changes are version-safe; old settlement history keeps its
        original snapshot.
      </Text>
      {rows.map((r) => (
        <Pressable
          key={r.role_key}
          onPress={() =>
            setEditing({
              ...r,
              target_units: String(r.target_units),
              salary_percent: String(r.salary_percent),
              advance_percent: String(r.advance_percent),
            })
          }
          style={s.row}
        >
          <View style={s.flex}>
            <Text style={s.rowTitle}>{r.role_name}</Text>
            <Text style={s.meta}>
              Target {n(r.target_units)} • Salary {r.salary_percent}% • Advance{" "}
              {r.advance_percent}% • {String(r.cycle).toUpperCase()}
            </Text>
          </View>
          <Text style={s.edit}>EDIT</Text>
        </Pressable>
      ))}
      {editing ? (
        <View style={s.card}><AiBackdrop opacity={.22}/>
          <Text style={s.rowTitle}>{editing.role_name}</Text>
          <TextInput
            value={String(editing.target_units)}
            onChangeText={(x) => setEditing({ ...editing, target_units: x })}
            keyboardType="number-pad"
            placeholder="Target units"
            placeholderTextColor="#737B8E"
            style={s.input}
          />
          <TextInput
            value={String(editing.salary_percent)}
            onChangeText={(x) => setEditing({ ...editing, salary_percent: x })}
            keyboardType="decimal-pad"
            placeholder="Salary %"
            placeholderTextColor="#737B8E"
            style={s.input}
          />
          <TextInput
            value={String(editing.advance_percent)}
            onChangeText={(x) => setEditing({ ...editing, advance_percent: x })}
            keyboardType="decimal-pad"
            placeholder="Advance %"
            placeholderTextColor="#737B8E"
            style={s.input}
          />
          <View style={s.types}>
            {["weekly", "monthly"].map((x) => (
              <Pressable
                key={x}
                onPress={() => setEditing({ ...editing, cycle: x })}
                style={[s.type, editing.cycle === x && s.typeOn]}
              >
                <Text style={s.typeText}>{x.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.switchLine}>
            <Text style={s.rowTitle}>Policy active</Text>
            <Switch
              value={Boolean(editing.active)}
              onValueChange={(x) => setEditing({ ...editing, active: x })}
            />
          </View>
          <View style={s.actions}>
            <Pressable onPress={() => setEditing(null)} style={s.secondary}>
              <Text style={s.secondaryText}>CANCEL</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={save} style={s.primary}>
              <Text style={s.primaryText}>SAVE POLICY</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function GiftPolicy() {
  const [rows, setRows] = useState([]),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    const { data, error } = await supabase
      .from("gift_catalog")
      .select("*")
      .order("sort_order")
      .order("coin_price");
    if (!error) setRows(data || []);
  };
  useEffect(() => {
    refresh();
  }, []);
  const save = async () => {
    const e = editing;
    if (!e) return;
    const combos = String(e.combo_text || "1,10,50,99")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isInteger(x) && x > 0);
    setBusy(true);
    const { error } = await supabase.rpc("owner_update_gift", {
      p_gift: e.id,
      p_name: e.name,
      p_coin_price: Number(e.coin_price),
      p_diamond_value: Number(e.diamond_value),
      p_category: e.category,
      p_combo_quantities: combos,
      p_allow_custom_combo: Boolean(e.allow_custom_combo),
      p_custom_combo_max: Number(e.custom_combo_max),
      p_active: Boolean(e.active),
      p_featured: Boolean(e.featured),
      p_asset_key: e.asset_key,
      p_effect_kind: e.effect_kind,
      p_effect_asset_url: e.effect_asset_url ?? null,
      p_sound_url: e.sound_url ?? null,
      p_sort_order: Number(e.sort_order),
      p_min_vip_level: Number(e.min_vip_level),
    });
    setBusy(false);
    if (error) return Alert.alert("Gift policy", error.message);
    setEditing(null);
    await refresh();
  };
  return (
    <View>
      <Text style={s.section}>Gift Catalog</Text>
      <Text style={s.help}>
        Prices, diamonds, categories and combo values stay server-driven so
        gifts can evolve without an app release.
      </Text>
      {rows.map((g) => (
        <Pressable
          key={g.id}
          onPress={() =>
            setEditing({
              ...g,
              combo_text: (g.combo_quantities || [1, 10, 50, 99]).join(","),
            })
          }
          style={s.giftRow}
        >
          <Text style={s.giftEmoji}>{g.asset_key || "🎁"}</Text>
          <View style={s.flex}>
            <Text style={s.rowTitle}>{g.name}</Text>
            <Text style={s.meta}>
              🪙 {n(g.coin_price)} • ◆ {n(g.diamond_value)} • {g.category} • v
              {g.policy_version}
            </Text>
          </View>
          <Text style={s.edit}>EDIT</Text>
        </Pressable>
      ))}
      {editing ? (
        <View style={s.card}><AiBackdrop opacity={.22}/>
          <Text style={s.rowTitle}>{editing.asset_key} Gift editor</Text>
          <TextInput
            value={editing.name}
            onChangeText={(x) => setEditing({ ...editing, name: x })}
            placeholder="Gift name"
            placeholderTextColor="#737B8E"
            style={s.input}
          />
          <TextInput
            value={String(editing.coin_price)}
            onChangeText={(x) => setEditing({ ...editing, coin_price: x })}
            keyboardType="number-pad"
            placeholder="Coin price"
            placeholderTextColor="#737B8E"
            style={s.input}
          />
          <TextInput
            value={String(editing.diamond_value)}
            onChangeText={(x) => setEditing({ ...editing, diamond_value: x })}
            keyboardType="number-pad"
            placeholder="Receiver diamonds"
            placeholderTextColor="#737B8E"
            style={s.input}
          />
          <TextInput
            value={editing.category}
            onChangeText={(x) => setEditing({ ...editing, category: x })}
            placeholder="Category"
            placeholderTextColor="#737B8E"
            style={s.input}
          />
          <TextInput
            value={editing.combo_text}
            onChangeText={(x) => setEditing({ ...editing, combo_text: x })}
            placeholder="Combos: 1,10,50,99"
            placeholderTextColor="#737B8E"
            style={s.input}
          />
          <TextInput
            value={String(editing.custom_combo_max)}
            onChangeText={(x) =>
              setEditing({ ...editing, custom_combo_max: x })
            }
            keyboardType="number-pad"
            placeholder="Custom combo max"
            placeholderTextColor="#737B8E"
            style={s.input}
          />
          <View style={s.switchLine}>
            <Text style={s.rowTitle}>Custom combo</Text>
            <Switch
              value={Boolean(editing.allow_custom_combo)}
              onValueChange={(x) =>
                setEditing({ ...editing, allow_custom_combo: x })
              }
            />
          </View>
          <View style={s.switchLine}>
            <Text style={s.rowTitle}>Featured</Text>
            <Switch
              value={Boolean(editing.featured)}
              onValueChange={(x) => setEditing({ ...editing, featured: x })}
            />
          </View>
          <View style={s.switchLine}>
            <Text style={s.rowTitle}>Active</Text>
            <Switch
              value={Boolean(editing.active)}
              onValueChange={(x) => setEditing({ ...editing, active: x })}
            />
          </View>
          <View style={s.actions}>
            <Pressable onPress={() => setEditing(null)} style={s.secondary}>
              <Text style={s.secondaryText}>CANCEL</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={save} style={s.primary}>
              <Text style={s.primaryText}>SAVE GIFT</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function NoticePublisher({ activeTool, onOpenTool }) {
  const [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [country, setCountry] = useState(""),
    [startsAt, setStartsAt] = useState(""),
    [expiresAt, setExpiresAt] = useState(""),
    [editingId, setEditingId] = useState(null),
    [history, setHistory] = useState([]),
    [showHistory,setShowHistory]=useState(false),[delivery,setDelivery]=useState("both"),[pinSystem,setPinSystem]=useState(false),[pinRoom,setPinRoom]=useState(false),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("owner_system_notice_history", {
      p_limit: 100,
    });
    setHistory(data || []);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const resetForm = () => {
    setTitle("");setBody("");setCountry("");setStartsAt("");setExpiresAt("");setEditingId(null);setDelivery("both");setPinSystem(false);setPinRoom(false);
  };
  const editNotice = (item) => {
    setEditingId(item.id);setTitle(item.title||"");setBody(item.body||"");setCountry(item.country_code||"");
    setStartsAt(item.starts_at||"");setExpiresAt(item.expires_at||"");setDelivery(item.delivery_target||"both");setPinSystem(Boolean(item.pin_system));setPinRoom(Boolean(item.pin_room));
  };
  const deleteNotice = (item) => {
    Alert.alert(
      "Delete this notice?",
      "It will disappear from Notice history. A protected audit snapshot will remain in the backend.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "DELETE",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.rpc("owner_delete_system_notice", {
              p_notice: item.id,
            });
            setBusy(false);
            if (error) return Alert.alert("Delete notice", error.message);
            if (editingId === item.id) resetForm();
            await refresh();
            Alert.alert("Deleted", "Notice removed. Protected audit record retained.");
          },
        },
      ],
    );
  };
  const send = () => {
    if (title.trim().length < 2 || body.trim().length < 2)
      return Alert.alert("Notice", "Title and message required");
    const startMs=startsAt.trim()?Date.parse(startsAt.trim()):null;
    const endMs=expiresAt.trim()?Date.parse(expiresAt.trim()):null;
    if(startMs!==null&&!Number.isFinite(startMs))return Alert.alert("Notice","Start date/time is invalid");
    if(endMs!==null&&!Number.isFinite(endMs))return Alert.alert("Notice","End date/time is invalid");
    if(endMs!==null&&endMs<=(startMs??Date.now()))return Alert.alert("Notice","End must be after start");
    Alert.alert(
      editingId?"Update official notice?":"Publish official notice?",
      country.trim()
        ? `Only ${country.trim().toUpperCase()} users will receive it.`
        : "All active users will receive it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: editingId?"UPDATE":"PUBLISH",
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.rpc("owner_save_notice_v85", {
              p_delivery:delivery,p_pin_system:pinSystem,p_pin_room:pinRoom,
              p_action: editingId?"update":"create",
              p_notice: editingId,
              p_title: title.trim(),
              p_body: body.trim(),
              p_country_code: country.trim() || null,
              p_starts_at: startsAt.trim() || null,
              p_expires_at: expiresAt.trim() || null,
            });
            setBusy(false);
            if (error) return Alert.alert("Notice", error.message);
            resetForm();
            await refresh();
            Alert.alert(
              editingId?"Updated":"Published",
              editingId?"System Notice updated and audit recorded.":"System Notice and notification records created.",
            );
          },
        },
      ],
    );
  };
  return (
    <View>
      <Text style={s.section}>Official System Notice</Text>
      <View style={s.noticeToolRow}>
        <Pressable onPress={() => onOpenTool?.("affinity")} style={[s.noticeTool, activeTool === "affinity" && s.noticeToolOn]}>
          <Text style={s.noticeToolTitle}>Break & Restore</Text>
          <Text style={s.noticeToolSub}>{activeTool === "affinity" ? "CLOSE" : "OPEN"}</Text>
        </Pressable>
        <Pressable onPress={() => onOpenTool?.("reset")} style={[s.noticeTool, activeTool === "reset" && s.noticeToolOn]}>
          <Text style={s.noticeToolTitle}>User Progress & Test Reset</Text>
          <Text style={s.noticeToolSub}>{activeTool === "reset" ? "CLOSE" : "OPEN"}</Text>
        </Pressable>
      </View>
      <View style={s.card}><AiBackdrop opacity={.22}/>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          placeholder="Notice title"
          placeholderTextColor="#737B8E"
          style={s.input}
        />
        <TextInput
          value={startsAt}
          onChangeText={setStartsAt}
          placeholder="Start (ISO date/time, blank = now)"
          placeholderTextColor="#737B8E"
          style={s.input}
        />
        <TextInput
          value={expiresAt}
          onChangeText={setExpiresAt}
          placeholder="End (ISO date/time, blank = no expiry)"
          placeholderTextColor="#737B8E"
          style={s.input}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={4000}
          placeholder="Official message"
          placeholderTextColor="#737B8E"
          style={[
            s.input,
            { minHeight: 100, textAlignVertical: "top", paddingTop: 11 },
          ]}
        />
        <TextInput
          value={country}
          onChangeText={setCountry}
          maxLength={2}
          autoCapitalize="characters"
          placeholder="Country code optional, e.g. IN"
          placeholderTextColor="#737B8E"
          style={s.input}
        />
        <View style={s.actions}>{[["system","System only"],["room","Room only"],["both","Both"]].map(([value,label])=><Pressable key={value} onPress={()=>setDelivery(value)} style={delivery===value?s.primary:s.secondary}><Text style={s.primaryText}>{label}</Text></Pressable>)}</View>
        {delivery!=="room"?<View style={s.switchLine}><Text style={s.rowTitle}>Pin in System Notification</Text><Switch value={pinSystem} onValueChange={setPinSystem}/></View>:null}
        {delivery!=="system"?<View style={s.switchLine}><Text style={s.rowTitle}>Pin on room screen</Text><Switch value={pinRoom} onValueChange={setPinRoom}/></View>:null}
        {editingId?<Pressable disabled={busy} onPress={resetForm} style={s.secondary}><Text style={s.secondaryText}>CANCEL EDIT</Text></Pressable>:null}
        <Pressable disabled={busy} onPress={send} style={s.primary}>
          <Text style={s.primaryText}>
            {busy ? "SAVING…" : editingId?"UPDATE OFFICIAL NOTICE":"PUBLISH OFFICIAL NOTICE"}
          </Text>
        </Pressable>
      </View>
      <View style={s.switchLine}><Text style={s.section}>Notice history</Text><Pressable onPress={()=>setShowHistory(x=>!x)}><Text style={s.secondaryText}>{showHistory?"Latest 5":"View history"}</Text></Pressable></View>
      {(showHistory?history:history.slice(0,5)).map((item) => (
        <View key={item.id} style={s.card}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View style={s.flex}>
              <Text style={s.rowTitle}>{item.title}</Text>
              <Text style={s.meta}>{item.body}</Text>
              <Text style={s.meta}>
                {item.country_code || "GLOBAL"} •{" "}
                {item.starts_at
                  ? new Date(item.starts_at).toLocaleString()
                  : "Now"}{" "}
                →{" "}
                {item.expires_at
                  ? new Date(item.expires_at).toLocaleString()
                  : "No expiry"}
              </Text>
              <Text style={s.meta}>Created by: {item.created_by||"Legacy/unknown"}</Text>
              <Text style={s.meta}>Last edited by: {item.updated_by||"—"}</Text>
              {item.deactivated_by?<Text style={s.meta}>Deactivated by: {item.deactivated_by}</Text>:null}
              <View style={s.noticeHistoryActions}>
                <Pressable onPress={()=>editNotice(item)} style={s.secondary}><Text style={s.secondaryText}>EDIT</Text></Pressable>
                <Pressable onPress={()=>deleteNotice(item)} style={s.deleteNotice}><Text style={s.deleteNoticeText}>DELETE</Text></Pressable>
              </View>
            </View>
            <Switch
              value={Boolean(item.active)}
              onValueChange={async (active) => {
                const { error } = await supabase.rpc(
                  "owner_manage_system_notice",
                  {
                    p_action: active ? "activate" : "deactivate",
                    p_notice: item.id,
                  },
                );
                if (error) return Alert.alert("Notice", error.message);
                await refresh();
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: "#0E121B",
    borderWidth: 1,
    borderColor: '#684974',
    borderRadius: 21,
    padding: 12,
    marginTop: 14,
  },
  mainTitle: { color: C.text, fontSize: 18, fontWeight: "900" },
  help: { color: C.muted, fontSize: 8, lineHeight: 14, marginTop: 4 },
  tabs: { gap: 6, paddingVertical: 11 },
  tab: {
    minWidth: 76,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: C.panelSoft,
    borderWidth: 1,
    borderColor: '#684974',
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  tabOn: { backgroundColor: C.violetDeep, borderColor: C.gold },
  tabIcon: { fontSize: 15 },
  tabText: { color: C.text, fontSize: 7, fontWeight: "900", marginTop: 2 },
  section: {
    color: C.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 7,
    marginBottom: 7,
  },
  card: {
    backgroundColor: '#180F25',
    borderWidth: 1,
    borderColor: '#684974',
    borderRadius: 17,
    padding: 10,
    marginTop: 7,
  },
  input: {
    minHeight: 43,
    borderRadius: 12,
    backgroundColor: "#0D1019",
    borderWidth: 1,
    borderColor: "#30364A",
    color: C.text,
    paddingHorizontal: 11,
    marginTop: 7,
    fontSize: 10,
  },
  primary: {
    flex: 1,
    minHeight: 43,
    borderRadius: 12,
    backgroundColor: C.violet,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  secondary: {
    flex: 1,
    minHeight: 43,
    borderRadius: 12,
    backgroundColor: C.panelSoft,
    borderWidth: 1,
    borderColor: '#684974',
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  secondaryText: { color: C.cyan, fontSize: 8, fontWeight: "900" },
  noticeToolRow: { flexDirection: "row", gap: 7, marginBottom: 4 },
  noticeTool: { flex: 1, minHeight: 54, borderRadius: 14, backgroundColor: C.panelSoft, borderWidth: 1, borderColor: '#684974', paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  noticeToolOn: { backgroundColor: C.violetDeep, borderColor: C.gold },
  noticeToolTitle: { color: C.text, fontSize: 8, fontWeight: "900", textAlign: "center" },
  noticeToolSub: { color: C.cyan, fontSize: 6, fontWeight: "900", marginTop: 3 },
  noticeHistoryActions: { flexDirection: "row", gap: 7 },
  deleteNotice: { flex: 1, minHeight: 43, borderRadius: 12, backgroundColor: "#4A1F2B", borderWidth: 1, borderColor: C.danger, alignItems: "center", justifyContent: "center", marginTop: 8 },
  deleteNoticeText: { color: "#FFC0CC", fontSize: 8, fontWeight: "900" },
  block: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#4A1F2B",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  blockText: { color: "#FFC0CC", fontSize: 8, fontWeight: "900" },
  roomHero: {
    minHeight: 80,
    borderRadius: 17,
    backgroundColor: "#17132D",
    borderWidth: 1,
    borderColor: "#4B3CA0",
    padding: 9,
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roomAvatar: {
    width: 49,
    height: 49,
    borderRadius: 16,
    backgroundColor: "#29234C",
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  rowTitle: { color: C.text, fontSize: 10, fontWeight: "900" },
  meta: { color: C.muted, fontSize: 7, lineHeight: 12, marginTop: 3 },
  dangerButton: {
    minWidth: 76,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#4A1F2B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  dangerText: { color: C.danger, fontSize: 6, fontWeight: "900" },
  person: {
    minHeight: 65,
    borderRadius: 16,
    backgroundColor: '#180F25',
    borderWidth: 1,
    borderColor: '#684974',
    padding: 8,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  miniActions: { flexDirection: "row", gap: 4, alignItems: "center" },
  mini: {
    minWidth: 42,
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: C.panelSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  miniDanger: { backgroundColor: "#3A1E29" },
  miniText: { color: C.cyan, fontSize: 6, fontWeight: "900" },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  type: {
    flexGrow: 1,
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: C.panelSoft,
    borderWidth: 1,
    borderColor: '#684974',
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  typeOn: { backgroundColor: C.violetDeep, borderColor: C.gold },
  typeText: { color: C.text, fontSize: 6, fontWeight: "900" },
  row: {
    minHeight: 68,
    borderRadius: 16,
    backgroundColor: '#180F25',
    borderWidth: 1,
    borderColor: '#684974',
    padding: 9,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  unban: {
    minWidth: 60,
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: "#19372E",
    alignItems: "center",
    justifyContent: "center",
  },
  unbanText: { color: C.green, fontSize: 7, fontWeight: "900" },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#29234C",
    alignItems: "center",
    justifyContent: "center",
  },
  approve: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#19372E",
    alignItems: "center",
    justifyContent: "center",
  },
  approveText: { color: C.green, fontSize: 16, fontWeight: "900" },
  reject: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#3A1E29",
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: { color: C.danger, fontSize: 16, fontWeight: "900" },
  status: { color: C.gold, fontSize: 6, fontWeight: "900" },
  edit: { color: C.cyan, fontSize: 7, fontWeight: "900" },
  switchLine: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 3,
    marginTop: 4,
  },
  actions: { flexDirection: "row", gap: 7 },
  giftRow: {
    minHeight: 67,
    borderRadius: 16,
    backgroundColor: '#180F25',
    borderWidth: 1,
    borderColor: '#684974',
    padding: 9,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  giftEmoji: { width: 40, textAlign: "center", fontSize: 26 },
});

