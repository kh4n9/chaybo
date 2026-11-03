#!/usr/bin/env node
/**
 * Vá lỗi build iOS của expo-modules-jsi 58.0.21 trên Xcode 26.2+ (Swift 6.2.3).
 *
 * Lỗi gốc:
 *   JavaScriptObject.swift:946:36: error: sending 'slot' risks causing data races
 *
 * Nguyên nhân: `slot` là con trỏ không Sendable bị closure `JavaScriptActor.assumeIsolated`
 * bắt giữ. Swift 6.2.3 coi đây là lỗi (các bản Swift trước chỉ cảnh báo).
 *
 * Cách vá (theo https://github.com/expo/expo/issues/52754): truyền địa chỉ dưới dạng `UInt`
 * rồi dựng lại con trỏ bên trong closure. Closure vẫn chạy đồng bộ trên cùng thread nên
 * hành vi không đổi.
 *
 * Script chạy tự động qua `postinstall`, và chạy lại được nhiều lần (idempotent).
 * Khi Expo phát hành bản vá chính thức, script chỉ in thông báo và bỏ qua.
 */

const fs = require('fs');
const path = require('path');

/* eslint-disable no-undef -- script Node.js thuần, không phải bundle React Native */

const FILE = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI',
  'Runtime',
  'Values',
  'JavaScriptObject.swift'
);

const OLD_A = `    // The isolated closure below runs synchronously on this thread.
    nonisolated(unsafe) let slot = buffer.baseAddress!`;

const NEW_A = `    let slot = buffer.baseAddress!
    // Pass the address as a plain integer so the isolated closure doesn't capture a non-Sendable pointer.
    // The isolated closure below runs synchronously on this thread.
    let slotAddress = UInt(bitPattern: slot)`;

const OLD_B = `      try JavaScriptActor.assumeIsolated {
        try encode(JavaScriptValue.Slot(slot), runtime)
      }`;

const NEW_B = `      try JavaScriptActor.assumeIsolated {
        let slot = UnsafeMutablePointer<facebook.jsi.Value>(bitPattern: slotAddress)!
        try encode(JavaScriptValue.Slot(slot), runtime)
      }`;

function main() {
  if (!fs.existsSync(FILE)) {
    console.log('[patch-expo-modules-jsi] Không tìm thấy expo-modules-jsi, bỏ qua.');
    return;
  }

  const original = fs.readFileSync(FILE, 'utf8');
  const source = original.replace(/\r\n/g, '\n');

  if (source.includes('slotAddress')) {
    console.log('[patch-expo-modules-jsi] Đã vá trước đó, bỏ qua.');
    return;
  }

  if (!source.includes(OLD_A) || !source.includes(OLD_B)) {
    console.log(
      '[patch-expo-modules-jsi] Không khớp mã nguồn mong đợi.\n' +
        'Có thể expo-modules-jsi đã được nâng cấp và không còn cần bản vá này.\n' +
        'Nếu build iOS vẫn lỗi "sending \'slot\' risks causing data races", hãy xem lại bản vá.'
    );
    return;
  }

  const patched = source.replace(OLD_A, NEW_A).replace(OLD_B, NEW_B);
  fs.writeFileSync(FILE, patched, 'utf8');
  console.log('[patch-expo-modules-jsi] Đã vá lỗi Swift 6.2.3 (expo/expo#52754).');
}

main();
