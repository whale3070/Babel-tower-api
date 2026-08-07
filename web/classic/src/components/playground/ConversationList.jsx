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

import React, { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Modal, Toast, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import {
  DEFAULT_CONVERSATION_TITLE,
} from '../../constants/playground.constants';

// 简单的相对时间格式化（不依赖 dayjs 插件，避免引入配置）
const formatRelativeTime = (ts, t) => {
  if (!ts) return '';
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t('刚刚');
  const min = Math.floor(sec / 60);
  if (min < 60) return t('{{n}} 分钟前', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('{{n}} 小时前', { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return t('{{n}} 天前', { n: day });
  const wk = Math.floor(day / 7);
  if (wk < 4) return t('{{n}} 周前', { n: wk });
  // 超过一个月直接显示日期
  try {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch (e) {
    return '';
  }
};

const ConversationList = ({
  conversations,
  currentConversationId,
  onCreate,
  onSwitch,
  onDelete,
  onDeleteBatch,
  onRename,
}) => {
  const { t } = useTranslation();

  // 选中模式（多选，用于批量删除）
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // 正在编辑标题的会话 id 与临时值
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const editInputRef = useRef(null);

  // 进入编辑模式时聚焦输入框
  useEffect(() => {
    if (editingId && editInputRef.current) {
      const el = editInputRef.current;
      try {
        el.focus();
        el.select();
      } catch (e) {
        // ignore
      }
    }
  }, [editingId]);

  const exitEditMode = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const startEdit = (conv) => {
    setEditingId(conv.id);
    setEditingValue(conv.title || '');
  };

  const commitEdit = () => {
    if (editingId) {
      onRename(editingId, editingValue);
    }
    exitEditMode();
  };

  const handleItemKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      exitEditMode();
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(conversations.map((c) => c.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteSingle = (conv) => {
    Modal.confirm({
      title: t('删除会话'),
      content: `${t('确定要删除这个会话吗？')} ${t('删除后会话无法恢复')}`,
      okText: t('删除'),
      cancelText: t('取消'),
      okButtonProps: { type: 'danger' },
      onOk: () => {
        onDelete(conv.id);
        // 同步清理选中状态
        setSelectedIds((prev) => {
          if (!prev.has(conv.id)) return prev;
          const next = new Set(prev);
          next.delete(conv.id);
          return next;
        });
        Toast.success({ content: t('已删除会话'), duration: 2 });
      },
    });
  };

  const handleBatchDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Modal.confirm({
      title: t('批量删除'),
      content: t('已选中 {{n}} 个会话，确定要全部删除吗？{{suffix}}', {
        n: ids.length,
        suffix: t('删除后会话无法恢复'),
      }),
      okText: t('删除'),
      cancelText: t('取消'),
      okButtonProps: { type: 'danger' },
      onOk: () => {
        onDeleteBatch(ids);
        setSelectedIds(new Set());
        Toast.success({
          content: t('已删除 {{n}} 个会话', { n: ids.length }),
          duration: 2,
        });
      },
    });
  };

  const handleCreate = () => {
    setSelectedIds(new Set());
    exitEditMode();
    onCreate();
  };

  const selectedCount = selectedIds.size;
  const isEmpty = !Array.isArray(conversations) || conversations.length === 0;

  return (
    <div className='flex h-full flex-col bg-white/95 backdrop-blur'>
      {/* 顶部：标题 + 新建按钮 */}
      <div className='border-b px-4 py-3'>
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2 min-w-0'>
            <MessageSquare size={16} className='text-purple-500 shrink-0' />
            <Typography.Text strong className='truncate'>
              {t('对话列表')}
            </Typography.Text>
          </div>
          <Button
            icon={<Plus size={14} />}
            theme='solid'
            type='primary'
            size='small'
            onClick={handleCreate}
            className='!rounded-lg'
            style={{
              background: 'linear-gradient(to right, #8b5cf6, #6366f1)',
            }}
          >
            {t('新建对话')}
          </Button>
        </div>
      </div>

      {/* 批量操作工具条（有选中时才显示） */}
      {selectedCount > 0 && (
        <div className='flex items-center justify-between gap-2 border-b bg-purple-50/60 px-4 py-2 text-sm'>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              className='text-purple-600 hover:underline'
              onClick={selectAll}
            >
              {t('全选')}
            </button>
            <button
              type='button'
              className='text-gray-500 hover:underline'
              onClick={selectNone}
            >
              {t('取消选择')}
            </button>
            <Typography.Text type='tertiary' className='text-xs'>
              {t('已选 {{n}} 项', { n: selectedCount })}
            </Typography.Text>
          </div>
          <Button
            icon={<Trash2 size={14} />}
            theme='solid'
            type='danger'
            size='small'
            onClick={handleBatchDelete}
            className='!rounded-lg'
          >
            {t('批量删除')}({selectedCount})
          </Button>
        </div>
      )}

      {/* 列表 */}
      <div className='flex-1 overflow-y-auto px-2 py-2'>
        {isEmpty ? (
          <Typography.Text
            type='tertiary'
            className='block px-3 py-8 text-center text-sm'
          >
            {t('点击「新建对话」开始')}
          </Typography.Text>
        ) : (
          <ul className='space-y-1'>
            {conversations.map((conv) => {
              const isActive = conv.id === currentConversationId;
              const isSelected = selectedIds.has(conv.id);
              const isEditing = editingId === conv.id;
              const title = conv.title || DEFAULT_CONVERSATION_TITLE;
              const msgCount = Array.isArray(conv.messages)
                ? conv.messages.length
                : 0;
              return (
                <li
                  key={conv.id}
                  className={`group relative rounded-lg transition-colors ${
                    isActive
                      ? 'bg-purple-50 ring-1 ring-purple-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* 左侧高亮条 */}
                  {isActive && (
                    <span
                      aria-hidden
                      className='absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full'
                      style={{
                        background:
                          'linear-gradient(to bottom, #8b5cf6, #6366f1)',
                      }}
                    />
                  )}
                  <div className='flex items-start gap-2 px-3 py-2.5'>
                    {/* checkbox（hover 或已选中时显示） */}
                    <span
                      className={`pt-0.5 ${
                        isSelected || 'opacity-0 group-hover:opacity-100'
                      } transition-opacity`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelect(conv.id)}
                        aria-label={t('选择该会话')}
                      />
                    </span>

                    {/* 主体：标题 + 时间 */}
                    <button
                      type='button'
                      className='flex-1 min-w-0 text-left'
                      onClick={() => {
                        if (isEditing) return;
                        onSwitch(conv.id);
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        startEdit(conv);
                      }}
                    >
                      {isEditing ? (
                        <div
                          className='flex items-center gap-1'
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            ref={editInputRef}
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={handleItemKey}
                            onBlur={commitEdit}
                            className='flex-1 min-w-0 rounded border border-purple-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200'
                            maxLength={100}
                          />
                          <button
                            type='button'
                            aria-label={t('保存')}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              commitEdit();
                            }}
                            className='rounded p-1 text-purple-600 hover:bg-purple-100'
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type='button'
                            aria-label={t('取消')}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              exitEditMode();
                            }}
                            className='rounded p-1 text-gray-400 hover:bg-gray-100'
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div
                            className={`truncate text-sm leading-snug ${
                              isActive
                                ? 'text-purple-700 font-medium'
                                : 'text-gray-800'
                            }`}
                            title={title}
                          >
                            {title}
                          </div>
                          <div className='mt-0.5 flex items-center gap-2 text-[11px] text-gray-400'>
                            <span>{formatRelativeTime(conv.updatedAt, t)}</span>
                            {msgCount > 0 && (
                              <span>· {t('{{n}} 条', { n: msgCount })}</span>
                            )}
                          </div>
                        </>
                      )}
                    </button>

                    {/* hover 操作（非编辑态显示） */}
                    {!isEditing && (
                      <div className='flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity'>
                        <button
                          type='button'
                          aria-label={t('重命名')}
                          title={t('重命名')}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(conv);
                          }}
                          className='rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type='button'
                          aria-label={t('删除会话')}
                          title={t('删除会话')}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSingle(conv);
                          }}
                          className='rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600'
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
