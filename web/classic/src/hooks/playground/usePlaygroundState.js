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

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_MESSAGES,
  getDefaultMessages,
  DEFAULT_CONFIG,
  DEBUG_TABS,
  MESSAGE_STATUS,
  DEFAULT_CONVERSATION_TITLE,
} from '../../constants/playground.constants';
import {
  loadConfig,
  saveConfig,
  loadMessages,
  saveMessages,
  loadConversations,
  saveConversations,
  loadCurrentConversationId,
  saveCurrentConversationId,
  createConversationObject,
  deriveConversationTitle,
} from '../../components/playground/configStorage';
import { processIncompleteThinkTags } from '../../helpers';

// 旧版 playground_messages 可能存的是远古默认示例；这种情况下不要迁移为会话
const isLegacyDefaultMessages = (msgs) => {
  if (!Array.isArray(msgs) || msgs.length !== 2) return false;
  if (msgs[0]?.id !== '2' || msgs[1]?.id !== '3') return false;
  const samples = [
    'Hello',
    'Hello! How can I help you today?',
    '你好',
    '你好，请问有什么可以帮助您的吗？',
    '你好，有什么我可以帮助你的吗？',
    '你好！很高兴见到你。有什么我可以帮助你的吗？',
  ];
  return (
    samples.includes(String(msgs[0]?.content || '')) ||
    samples.includes(String(msgs[1]?.content || ''))
  );
};

// 集中初始化会话相关状态：返回 { list, currentId, messages }
const initializeConversations = () => {
  let list = loadConversations();

  // 若列表为空，且旧 messages 也是空或者是远古默认示例，则创建一条空白会话作为起点
  if (list.length === 0) {
    const fresh = createConversationObject();
    list = [fresh];
    saveConversations(list);
    saveCurrentConversationId(fresh.id);
    return { list, currentId: fresh.id, messages: [] };
  }

  let currentId = loadCurrentConversationId();
  if (!currentId || !list.some((c) => c.id === currentId)) {
    currentId = list[0].id;
    saveCurrentConversationId(currentId);
  }
  const current = list.find((c) => c.id === currentId);
  const messages = current ? Array.isArray(current.messages) ? [...current.messages] : [] : [];
  return { list, currentId, messages };
};

export const usePlaygroundState = () => {
  const { t } = useTranslation();

  // 配置仍然独立加载
  const [savedConfig] = useState(() => loadConfig());

  // 会话与消息集中初始化（避免 useState 间互相依赖）
  const [{ list: initConvList, currentId: initCurrentId, messages: initMessages }] =
    useState(initializeConversations);

  // 基础配置状态
  const [inputs, setInputs] = useState(
    savedConfig.inputs || DEFAULT_CONFIG.inputs,
  );
  const [parameterEnabled, setParameterEnabled] = useState(
    savedConfig.parameterEnabled || DEFAULT_CONFIG.parameterEnabled,
  );
  const [showDebugPanel, setShowDebugPanel] = useState(
    savedConfig.showDebugPanel || DEFAULT_CONFIG.showDebugPanel,
  );
  const [customRequestMode, setCustomRequestMode] = useState(
    savedConfig.customRequestMode || DEFAULT_CONFIG.customRequestMode,
  );
  const [customRequestBody, setCustomRequestBody] = useState(
    savedConfig.customRequestBody || DEFAULT_CONFIG.customRequestBody,
  );

  // UI状态
  const [showSettings, setShowSettings] = useState(false);
  const [models, setModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState({});

  // 会话状态
  const [conversations, setConversations] = useState(initConvList);
  const [currentConversationId, setCurrentConversationId] =
    useState(initCurrentId);

  // 当前会话的消息（派生自当前会话，切换会话时整体替换）
  const [message, setMessage] = useState(initMessages);

  // 当前会话对象（用于 UI 显示标题等）
  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === currentConversationId) || null,
    [conversations, currentConversationId],
  );

  // 调试状态
  const [debugData, setDebugData] = useState({
    request: null,
    response: null,
    timestamp: null,
    previewRequest: null,
    previewTimestamp: null,
  });
  const [activeDebugTab, setActiveDebugTab] = useState(DEBUG_TABS.PREVIEW);
  const [previewPayload, setPreviewPayload] = useState(null);

  // 编辑状态
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Refs
  const sseSourceRef = useRef(null);
  const chatRef = useRef(null);
  const saveConfigTimeoutRef = useRef(null);
  const saveMessagesTimeoutRef = useRef(null);

  // 配置更新函数
  const handleInputChange = useCallback((name, value) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleParameterToggle = useCallback((paramName) => {
    setParameterEnabled((prev) => ({
      ...prev,
      [paramName]: !prev[paramName],
    }));
  }, []);

  // 消息保存函数：将当前消息同步到当前会话并持久化
  const saveMessagesImmediately = useCallback(
    (messagesToSave) => {
      const msgs = messagesToSave || message;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === currentConversationId);
        if (idx === -1) {
          return prev;
        }
        const oldConv = prev[idx];
        const nextConv = {
          ...oldConv,
          messages: msgs,
          updatedAt: Date.now(),
          title:
            (oldConv.title === DEFAULT_CONVERSATION_TITLE ||
              !oldConv.title) &&
            Array.isArray(msgs) &&
            msgs.length > 0
              ? deriveConversationTitle(msgs)
              : oldConv.title,
        };
        const next = [...prev];
        next[idx] = nextConv;
        saveConversations(next);
        return next;
      });
      // 同时写旧 key 以兼容外部读取（ConfigManager 导出等）
      saveMessages(msgs);
    },
    [message, currentConversationId],
  );

  // 配置保存
  const debouncedSaveConfig = useCallback(() => {
    if (saveConfigTimeoutRef.current) {
      clearTimeout(saveConfigTimeoutRef.current);
    }

    saveConfigTimeoutRef.current = setTimeout(() => {
      const configToSave = {
        inputs,
        parameterEnabled,
        showDebugPanel,
        customRequestMode,
        customRequestBody,
      };
      saveConfig(configToSave);
    }, 1000);
  }, [
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
  ]);

  // ========== 会话增删改切换 ==========

  // 新建空会话并切到该会话。可重复调用，每次都会新增一条。
  const createConversation = useCallback(() => {
    const conv = createConversationObject();
    setConversations((prev) => {
      const next = [conv, ...prev];
      saveConversations(next);
      return next;
    });
    setCurrentConversationId(conv.id);
    saveCurrentConversationId(conv.id);
    setMessage([]);
    return conv.id;
  }, []);

  // 切换到指定会话
  const switchConversation = useCallback(
    (id) => {
      if (!id || id === currentConversationId) return;
      const target = conversations.find((c) => c.id === id);
      if (!target) return;
      setCurrentConversationId(id);
      saveCurrentConversationId(id);
      setMessage(Array.isArray(target.messages) ? [...target.messages] : []);
    },
    [conversations, currentConversationId],
  );

  // 删除单个会话；若删的是当前会话，自动切到最近一条，没有则新建空会话
  const deleteConversation = useCallback(
    (id) => {
      if (!id) return;
      const nextList = conversations.filter((c) => c.id !== id);
      setConversations(nextList);
      saveConversations(nextList);

      if (id !== currentConversationId) return;

      if (nextList.length === 0) {
        const fresh = createConversationObject();
        setConversations([fresh]);
        saveConversations([fresh]);
        setCurrentConversationId(fresh.id);
        saveCurrentConversationId(fresh.id);
        setMessage([]);
      } else {
        const next = nextList[0];
        setCurrentConversationId(next.id);
        saveCurrentConversationId(next.id);
        setMessage(Array.isArray(next.messages) ? [...next.messages] : []);
      }
    },
    [conversations, currentConversationId],
  );

  // 批量删除
  const deleteConversations = useCallback(
    (ids) => {
      if (!Array.isArray(ids) || ids.length === 0) return;
      const idSet = new Set(ids);
      const nextList = conversations.filter((c) => !idSet.has(c.id));
      setConversations(nextList);
      saveConversations(nextList);

      if (!idSet.has(currentConversationId)) return;

      if (nextList.length === 0) {
        const fresh = createConversationObject();
        setConversations([fresh]);
        saveConversations([fresh]);
        setCurrentConversationId(fresh.id);
        saveCurrentConversationId(fresh.id);
        setMessage([]);
      } else {
        const next = nextList[0];
        setCurrentConversationId(next.id);
        saveCurrentConversationId(next.id);
        setMessage(Array.isArray(next.messages) ? [...next.messages] : []);
      }
    },
    [conversations, currentConversationId],
  );

  // 重命名
  const renameConversation = useCallback((id, title) => {
    const cleaned = (title || '').trim().slice(0, 100);
    const newTitle = cleaned || DEFAULT_CONVERSATION_TITLE;
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        title: newTitle,
        updatedAt: Date.now(),
      };
      saveConversations(next);
      return next;
    });
  }, []);

  // 配置导入/重置
  const handleConfigImport = useCallback(
    (importedConfig) => {
      if (importedConfig.inputs) {
        const parsedMaxTokens = parseInt(importedConfig.inputs.max_tokens, 10);
        setInputs((prev) => ({
          ...prev,
          ...importedConfig.inputs,
          max_tokens: Number.isNaN(parsedMaxTokens)
            ? importedConfig.inputs.max_tokens
            : parsedMaxTokens,
        }));
      }
      if (importedConfig.parameterEnabled) {
        setParameterEnabled((prev) => ({
          ...prev,
          ...importedConfig.parameterEnabled,
        }));
      }
      if (typeof importedConfig.showDebugPanel === 'boolean') {
        setShowDebugPanel(importedConfig.showDebugPanel);
      }
      if (importedConfig.customRequestMode) {
        setCustomRequestMode(importedConfig.customRequestMode);
      }
      if (importedConfig.customRequestBody) {
        setCustomRequestBody(importedConfig.customRequestBody);
      }
      // 如果导入的配置包含消息，写入当前会话
      if (importedConfig.messages && Array.isArray(importedConfig.messages)) {
        setMessage(importedConfig.messages);
        setTimeout(
          () => saveMessagesImmediately(importedConfig.messages),
          0,
        );
      }
    },
    [saveMessagesImmediately],
  );

  const handleConfigReset = useCallback(
    (options = {}) => {
      const { resetMessages = false } = options;

      setInputs(DEFAULT_CONFIG.inputs);
      setParameterEnabled(DEFAULT_CONFIG.parameterEnabled);
      setShowDebugPanel(DEFAULT_CONFIG.showDebugPanel);
      setCustomRequestMode(DEFAULT_CONFIG.customRequestMode);
      setCustomRequestBody(DEFAULT_CONFIG.customRequestBody);

      // 重置消息=清空当前会话
      if (resetMessages) {
        setMessage([]);
        setTimeout(() => saveMessagesImmediately([]), 0);
      }
    },
    [saveMessagesImmediately],
  );

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveConfigTimeoutRef.current) {
        clearTimeout(saveConfigTimeoutRef.current);
      }
    };
  }, []);

  // 页面首次加载时，若最后一条消息仍处于 LOADING/INCOMPLETE 状态，自动修复
  useEffect(() => {
    if (!Array.isArray(message) || message.length === 0) return;

    const lastMsg = message[message.length - 1];
    if (
      lastMsg.status === MESSAGE_STATUS.LOADING ||
      lastMsg.status === MESSAGE_STATUS.INCOMPLETE
    ) {
      const processed = processIncompleteThinkTags(
        lastMsg.content || '',
        lastMsg.reasoningContent || '',
      );

      const fixedLastMsg = {
        ...lastMsg,
        status: MESSAGE_STATUS.COMPLETE,
        content: processed.content,
        reasoningContent: processed.reasoningContent || null,
        isThinkingComplete: true,
      };

      const updatedMessages = [...message.slice(0, -1), fixedLastMsg];
      setMessage(updatedMessages);

      // 保存修复后的消息列表
      setTimeout(() => saveMessagesImmediately(updatedMessages), 0);
    }
    // 只在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // 配置状态
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,

    // UI状态
    showSettings,
    models,
    groups,
    status,

    // 会话状态
    conversations,
    currentConversationId,
    currentConversation,
    message,

    // 调试状态
    debugData,
    activeDebugTab,
    previewPayload,

    // 编辑状态
    editingMessageId,
    editValue,

    // Refs
    sseSourceRef,
    chatRef,
    saveConfigTimeoutRef,

    // 更新函数
    setInputs,
    setParameterEnabled,
    setShowDebugPanel,
    setCustomRequestMode,
    setCustomRequestBody,
    setShowSettings,
    setModels,
    setGroups,
    setStatus,
    setMessage,
    setConversations,
    setCurrentConversationId,
    setDebugData,
    setActiveDebugTab,
    setPreviewPayload,
    setEditingMessageId,
    setEditValue,

    // 处理函数
    handleInputChange,
    handleParameterToggle,
    debouncedSaveConfig,
    saveMessagesImmediately,
    handleConfigImport,
    handleConfigReset,

    // 会话操作
    createConversation,
    switchConversation,
    deleteConversation,
    deleteConversations,
    renameConversation,
  };
};
