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

import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  DEFAULT_CONVERSATION_TITLE,
  CONVERSATION_TITLE_MAX_LENGTH,
} from '../../constants/playground.constants';

const MESSAGES_STORAGE_KEY = 'playground_messages';

// 生成会话 ID：优先用 crypto.randomUUID，否则用时间戳+随机数兜底
const generateConversationId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // ignore
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

// 从消息列表里提取首条用户消息的纯文本作为标题
export const deriveConversationTitle = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return DEFAULT_CONVERSATION_TITLE;
  }
  const firstUser = messages.find((m) => m && m.role === 'user');
  if (!firstUser) {
    return DEFAULT_CONVERSATION_TITLE;
  }
  let text = '';
  if (typeof firstUser.content === 'string') {
    text = firstUser.content;
  } else if (Array.isArray(firstUser.content)) {
    const t = firstUser.content.find((it) => it && it.type === 'text');
    text = t?.text || '';
  }
  text = (text || '').trim().replace(/\s+/g, ' ');
  if (!text) {
    return DEFAULT_CONVERSATION_TITLE;
  }
  return text.length > CONVERSATION_TITLE_MAX_LENGTH
    ? text.slice(0, CONVERSATION_TITLE_MAX_LENGTH)
    : text;
};

// 按 updatedAt 降序排序
const sortConversations = (list) =>
  [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

/**
 * 保存配置到 localStorage
 * @param {Object} config - 要保存的配置对象
 */
export const saveConfig = (config) => {
  try {
    const configToSave = {
      ...config,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(configToSave));
  } catch (error) {
    console.error('保存配置失败:', error);
  }
};

/**
 * 保存消息到 localStorage
 * @param {Array} messages - 要保存的消息数组
 */
export const saveMessages = (messages) => {
  try {
    const messagesToSave = {
      messages,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messagesToSave));
  } catch (error) {
    console.error('保存消息失败:', error);
  }
};

/**
 * 从 localStorage 加载配置
 * @returns {Object} 配置对象，如果不存在则返回默认配置
 */
export const loadConfig = () => {
  try {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      const parsedMaxTokens = parseInt(parsedConfig?.inputs?.max_tokens, 10);

      const mergedConfig = {
        inputs: {
          ...DEFAULT_CONFIG.inputs,
          ...parsedConfig.inputs,
          max_tokens: Number.isNaN(parsedMaxTokens)
            ? parsedConfig?.inputs?.max_tokens
            : parsedMaxTokens,
        },
        parameterEnabled: {
          ...DEFAULT_CONFIG.parameterEnabled,
          ...parsedConfig.parameterEnabled,
        },
        showDebugPanel:
          parsedConfig.showDebugPanel || DEFAULT_CONFIG.showDebugPanel,
        customRequestMode:
          parsedConfig.customRequestMode || DEFAULT_CONFIG.customRequestMode,
        customRequestBody:
          parsedConfig.customRequestBody || DEFAULT_CONFIG.customRequestBody,
      };

      return mergedConfig;
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }

  return DEFAULT_CONFIG;
};

/**
 * 从 localStorage 加载消息
 * @returns {Array} 消息数组，如果不存在则返回 null
 */
export const loadMessages = () => {
  try {
    const savedMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages);
      return parsedMessages.messages || null;
    }
  } catch (error) {
    console.error('加载消息失败:', error);
  }

  return null;
};

/**
 * 清除保存的配置
 */
export const clearConfig = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES); // 同时清除消息
  } catch (error) {
    console.error('清除配置失败:', error);
  }
};

/**
 * 清除保存的消息
 */
export const clearMessages = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
  } catch (error) {
    console.error('清除消息失败:', error);
  }
};

/**
 * 检查是否有保存的配置
 * @returns {boolean} 是否存在保存的配置
 */
export const hasStoredConfig = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.CONFIG) !== null;
  } catch (error) {
    console.error('检查配置失败:', error);
    return false;
  }
};

/**
 * 获取配置的最后保存时间
 * @returns {string|null} 最后保存时间的 ISO 字符串
 */
export const getConfigTimestamp = () => {
  try {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      return parsedConfig.timestamp || null;
    }
  } catch (error) {
    console.error('获取配置时间戳失败:', error);
  }
  return null;
};

/**
 * 导出配置为 JSON 文件（包含消息）
 * @param {Object} config - 要导出的配置
 * @param {Array} messages - 要导出的消息
 */
export const exportConfig = (config, messages = null) => {
  try {
    const configToExport = {
      ...config,
      messages: messages || loadMessages(), // 包含消息数据
      exportTime: new Date().toISOString(),
      version: '1.0',
    };

    const dataStr = JSON.stringify(configToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `playground-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('导出配置失败:', error);
  }
};

/**
 * 从文件导入配置（包含消息）
 * @param {File} file - 包含配置的 JSON 文件
 * @returns {Promise<Object>} 导入的配置对象
 */
export const importConfig = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedConfig = JSON.parse(e.target.result);

          if (importedConfig.inputs && importedConfig.parameterEnabled) {
            // 如果导入的配置包含消息，也一起导入
            if (
              importedConfig.messages &&
              Array.isArray(importedConfig.messages)
            ) {
              saveMessages(importedConfig.messages);
            }

            resolve(importedConfig);
          } else {
            reject(new Error('配置文件格式无效'));
          }
        } catch (parseError) {
          reject(new Error('解析配置文件失败: ' + parseError.message));
        }
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    } catch (error) {
      reject(new Error('导入配置失败: ' + error.message));
    }
  });
};

// ========== 会话（多会话）相关 ==========

/**
 * 创建一个空的会话对象（仅内存，不写入 localStorage）
 * @param {Object} [overrides]
 * @returns {Object} 会话对象
 */
export const createConversationObject = (overrides = {}) => {
  const now = Date.now();
  return {
    id: generateConversationId(),
    title: DEFAULT_CONVERSATION_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

/**
 * 从 localStorage 加载所有会话（按 updatedAt 降序）。
 * 迁移：若 playground_conversations 不存在但旧 playground_messages 存在，
 * 把旧消息打包成一个会话写入并返回（不删除旧 key）。
 * @returns {Array} 会话数组
 */
export const loadConversations = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed?.conversations)
        ? parsed.conversations
        : Array.isArray(parsed)
          ? parsed
          : [];
      return sortConversations(list.filter(Boolean));
    }

    // 迁移：把旧的单会话消息包成一条会话
    const legacy = loadMessages();
    if (Array.isArray(legacy) && legacy.length > 0) {
      const now = Date.now();
      const migrated = createConversationObject({
        title: deriveConversationTitle(legacy),
        messages: legacy,
        createdAt: legacy[0]?.createAt || now,
        updatedAt: now,
      });
      saveConversations([migrated]);
      return [migrated];
    }

    return [];
  } catch (error) {
    console.error('加载会话列表失败:', error);
    return [];
  }
};

/**
 * 保存会话列表到 localStorage（按原顺序保存，不强制排序）。
 * @param {Array} conversations - 要保存的会话数组
 */
export const saveConversations = (conversations) => {
  try {
    const payload = {
      conversations: Array.isArray(conversations) ? conversations : [],
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(
      STORAGE_KEYS.CONVERSATIONS,
      JSON.stringify(payload),
    );
  } catch (error) {
    console.error('保存会话列表失败:', error);
  }
};

/**
 * 读取上次激活的会话 ID。
 * @returns {string|null}
 */
export const loadCurrentConversationId = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID) || null;
  } catch (error) {
    console.error('读取当前会话 ID 失败:', error);
    return null;
  }
};

/**
 * 持久化当前会话 ID。
 * @param {string|null} id
 */
export const saveCurrentConversationId = (id) => {
  try {
    if (id == null || id === '') {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID);
    } else {
      localStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, id);
    }
  } catch (error) {
    console.error('保存当前会话 ID 失败:', error);
  }
};

/**
 * 清空所有会话（不影响 config 和 messages 旧 key）。
 */
export const clearConversations = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID);
  } catch (error) {
    console.error('清空会话列表失败:', error);
  }
};
