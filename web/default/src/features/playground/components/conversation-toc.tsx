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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListTree, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  buildConversationTurns,
  scrollToPlaygroundMessage,
} from '../lib/playground-toc'
import type { Message } from '../types'

interface ConversationTocProps {
  messages: Message[]
  onClose?: () => void
  className?: string
}

export function ConversationToc({
  messages,
  onClose,
  className = '',
}: ConversationTocProps) {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState<string | null>(null)

  const turns = useMemo(
    () => buildConversationTurns(messages, t),
    [messages, t]
  )

  useEffect(() => {
    if (turns.length === 0) {
      setActiveId(null)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )

        if (visible.length > 0) {
          const anchorId = visible[0].target.id
          const matched = turns.find((turn) => turn.anchorId === anchorId)
          if (matched) setActiveId(matched.id)
        }
      },
      {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    )

    turns.forEach((turn) => {
      const node = document.getElementById(turn.anchorId)
      if (node) observer.observe(node)
    })

    return () => observer.disconnect()
  }, [turns])

  return (
    <aside
      className={`bg-background flex h-full w-60 flex-col border-l ${className}`}
    >
      <div className='flex items-center justify-between gap-2 border-b px-4 py-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <ListTree className='text-primary size-4 shrink-0' />
          <span className='truncate text-sm font-semibold'>
            {t('Conversation outline')}
          </span>
        </div>
        {onClose && (
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={onClose}
            aria-label={t('Close')}
          >
            <X className='size-4' />
          </Button>
        )}
      </div>

      <div className='flex-1 overflow-y-auto px-3 py-3'>
        {turns.length === 0 ? (
          <p className='text-muted-foreground px-2 py-4 text-sm'>
            {t(
              'Send your first message and each turn will appear here as a clickable title.'
            )}
          </p>
        ) : (
          <nav aria-label={t('Conversation outline')}>
            <ul className='space-y-1'>
              {turns.map((turn) => {
                const isActive = activeId === turn.id
                return (
                  <li key={turn.id}>
                    <button
                      type='button'
                      onClick={() => {
                        setActiveId(turn.id)
                        scrollToPlaygroundMessage(turn.id)
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary ring-primary/20 ring-1'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className='text-[11px] font-medium tracking-wide uppercase opacity-60'>
                        {t('Turn {{n}}', { n: turn.turnNumber })}
                      </div>
                      <div
                        className='mt-0.5 line-clamp-2 text-sm leading-snug'
                        title={turn.title}
                      >
                        {turn.title}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
      </div>
    </aside>
  )
}
