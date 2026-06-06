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

import React, { useEffect, useMemo, useState } from 'react';
import { Typography, Button } from '@douyinfe/semi-ui';
import { ListTree, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  buildConversationTurns,
  scrollToPlaygroundMessage,
} from '../../helpers/playgroundToc';

const ConversationToc = ({
  messages,
  styleState,
  onClose,
  className = '',
}) => {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState(null);

  const turns = useMemo(
    () => buildConversationTurns(messages, t),
    [messages, t],
  );

  useEffect(() => {
    if (turns.length === 0) {
      setActiveId(null);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );

        if (visible.length > 0) {
          const anchorId = visible[0].target.id;
          const matched = turns.find((turn) => turn.anchorId === anchorId);
          if (matched) setActiveId(matched.id);
        }
      },
      {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      },
    );

    turns.forEach((turn) => {
      const node = document.getElementById(turn.anchorId);
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [turns]);

  const handleClick = (messageId) => {
    setActiveId(messageId);
    scrollToPlaygroundMessage(messageId);
  };

  return (
    <div
      className={`flex h-full flex-col bg-white/95 backdrop-blur ${className}`}
      style={{ borderLeft: '1px solid var(--semi-color-border)' }}
    >
      <div className='flex items-center justify-between gap-2 border-b px-4 py-3'>
        <div className='flex items-center gap-2 min-w-0'>
          <ListTree size={16} className='text-purple-500 shrink-0' />
          <Typography.Text strong className='truncate'>
            {t('对话目录')}
          </Typography.Text>
        </div>
        {onClose && (
          <Button
            icon={<X size={14} />}
            theme='borderless'
            size='small'
            onClick={onClose}
            aria-label={t('关闭')}
          />
        )}
      </div>

      <div className='flex-1 overflow-y-auto px-3 py-3'>
        {turns.length === 0 ? (
          <Typography.Text type='tertiary' className='block px-2 py-4 text-sm'>
            {t('发送第一条消息后，这里会列出各轮对话标题')}
          </Typography.Text>
        ) : (
          <nav aria-label={t('对话目录')}>
            <ul className='space-y-1'>
              {turns.map((turn) => {
                const isActive = activeId === turn.id;
                return (
                  <li key={turn.id}>
                    <button
                      type='button'
                      onClick={() => handleClick(turn.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                        isActive
                          ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className='text-[11px] font-medium uppercase tracking-wide opacity-60'>
                        {t('第 {{n}} 轮', { n: turn.turnNumber })}
                      </div>
                      <div
                        className={`mt-0.5 text-sm leading-snug ${
                          styleState?.isMobile ? 'line-clamp-3' : 'line-clamp-2'
                        }`}
                        title={turn.title}
                      >
                        {turn.title}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
};

export default ConversationToc;
