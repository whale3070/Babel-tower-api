/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { getTextContent } from './utils';
import { MESSAGE_ROLES } from '../constants/playground.constants';

export const PLAYGROUND_MESSAGE_ANCHOR_PREFIX = 'playground-msg-';

export function getPlaygroundMessageAnchorId(messageId) {
  return `${PLAYGROUND_MESSAGE_ANCHOR_PREFIX}${messageId}`;
}

export function formatTocTitle(text, maxLength = 48) {
  const normalized = (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split('\n')[0]
    .trim();

  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

/**
 * Build TOC entries — one item per user turn (question).
 */
export function buildConversationTurns(messages, t) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  let turnNumber = 0;

  return messages
    .filter((msg) => msg.role === MESSAGE_ROLES.USER)
    .map((msg) => {
      turnNumber += 1;
      const text = getTextContent(msg);
      const title =
        formatTocTitle(text) ||
        t('对话 {{n}}', { n: turnNumber, defaultValue: `对话 ${turnNumber}` });

      return {
        id: msg.id,
        anchorId: getPlaygroundMessageAnchorId(msg.id),
        turnNumber,
        role: msg.role,
        title,
      };
    });
}

export function scrollToPlaygroundMessage(messageId) {
  const anchor = document.getElementById(
    getPlaygroundMessageAnchorId(messageId),
  );
  if (!anchor) return false;

  anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}
