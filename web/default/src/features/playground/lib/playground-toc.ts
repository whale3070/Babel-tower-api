/*
Copyright (C) 2023-2026 QuantumNous

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
import type { TFunction } from 'i18next'
import { MESSAGE_ROLES } from '../constants'
import type { Message } from '../types'

export const PLAYGROUND_MESSAGE_ANCHOR_PREFIX = 'playground-msg-'

export function getPlaygroundMessageAnchorId(messageKey: string) {
  return `${PLAYGROUND_MESSAGE_ANCHOR_PREFIX}${messageKey}`
}

export function formatTocTitle(text: string, maxLength = 48) {
  const normalized = (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split('\n')[0]
    .trim()

  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}…`
}

export interface ConversationTurn {
  id: string
  anchorId: string
  turnNumber: number
  role: string
  title: string
}

export function buildConversationTurns(
  messages: Message[],
  t: TFunction
): ConversationTurn[] {
  let turnNumber = 0

  return messages
    .filter((msg) => msg.from === MESSAGE_ROLES.USER)
    .map((msg) => {
      turnNumber += 1
      const text = msg.versions?.[0]?.content || ''
      const title =
        formatTocTitle(text) ||
        t('Conversation {{n}}', { n: turnNumber, defaultValue: `Turn ${turnNumber}` })

      return {
        id: msg.key,
        anchorId: getPlaygroundMessageAnchorId(msg.key),
        turnNumber,
        role: msg.from,
        title,
      }
    })
}

export function scrollToPlaygroundMessage(messageKey: string) {
  const anchor = document.getElementById(
    getPlaygroundMessageAnchorId(messageKey)
  )
  if (!anchor) return false

  anchor.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}
