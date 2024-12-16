document.addEventListener('DOMContentLoaded', function () {
    const folderList = document.getElementById('folder-list');
    const bookmarkList = document.getElementById('bookmark-list');
    const searchBar = document.getElementById('search-bar');
    const editModal = document.getElementById('edit-modal');
    const editTitleInput = document.getElementById('edit-title');
    const editUrlInput = document.getElementById('edit-url');
    const saveEditBtn = document.getElementById('save-edit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    // 添加自定义下拉菜单相关元素
    const selectSelected = document.querySelector('.select-selected');
    const selectItems = document.querySelector('.select-items');
    const sortSelect = document.getElementById('sort-select');

    let currentBookmarks = []; // 存储当前文件夹的书签
    let currentEditingBookmark = null;
    let isGlobalSearch = false;

    // 拖拽排序相关变量
    let draggedItem = null;
    let draggedIndex = null;

    // 添加 emoji 列表
    const categoryEmojis = {
        'github': '💻',
        'google': '🔍',
        'default': ['📚', '🌟', '💡', '🎨', '🎮', '🎵', '📱', '🌈', '🐾', '🪸', '🌴', '🍉', '🪇', '☃️',
            '🌹', '🦝',
            '⭐', '📝', '🥶', '🎭', '🎼', '👻', '🎃', '🫥', '🫡', '😎', '🥸', '🦣', '🐓']
    };

    // 访问频率存储
    let visitCounts = {};

    // 从 chrome.storage 加载访问计数
    chrome.storage.local.get(['visitCounts'], function (result) {
        visitCounts = result.visitCounts || {};
    });

    // 记录访问次数
    function recordVisit(url) {
        visitCounts[url] = (visitCounts[url] || 0) + 1;
        chrome.storage.local.set({ visitCounts: visitCounts });
    }

    // 排序函数
    function sortBookmarks(bookmarks, sortType) {
        const sortedBookmarks = [...bookmarks];

        switch (sortType) {
            case 'frequency':
                sortedBookmarks.sort((a, b) => {
                    const countA = visitCounts[a.url] || 0;
                    const countB = visitCounts[b.url] || 0;
                    return countB - countA;
                });
                break;

            case 'domain':
                sortedBookmarks.sort((a, b) => {
                    const domainA = new URL(a.url).hostname;
                    const domainB = new URL(b.url).hostname;
                    return domainA.localeCompare(domainB);
                });
                break;

            case 'title':
                sortedBookmarks.sort((a, b) =>
                    a.title.localeCompare(b.title)
                );
                break;

            case 'date':
                sortedBookmarks.sort((a, b) =>
                    b.dateAdded - a.dateAdded
                );
                break;

            default:
                // 保持原始顺序
                break;
        }

        return sortedBookmarks;
    }

    // 获取 URL 对应的 emoji
    function getEmojiForUrl(url) {
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            for (let site in categoryEmojis) {
                if (hostname.includes(site)) {
                    return categoryEmojis[site];
                }
            }
            // 返回随机默认 emoji
            return categoryEmojis.default[Math.floor(Math.random() * categoryEmojis.default.length)];
        } catch (e) {
            return categoryEmojis.default[0];
        }
    }

    // 显示书签目录下的书签
    function displayBookmarks(folderId) {
        if (!folderId) return;

        isGlobalSearch = false;
        searchBar.value = '';
        searchBar.placeholder = getMessage('searchPlaceholder');

        // 更新文件夹选中状态
        document.querySelectorAll('#folder-list li').forEach(item => {
            item.classList.remove('active');
        });
        const selectedFolder = document.querySelector(`#folder-list li[data-folder-id="${folderId}"]`);
        if (selectedFolder) {
            selectedFolder.classList.add('active');
        }

        // 显示排序选项并重置为默认值
        const sortOptions = document.querySelector('.sort-options');
        sortOptions.classList.add('show');
        document.getElementById('sort-select').value = 'default';

        // 获取并显示书签
        chrome.bookmarks.getChildren(folderId, function (children) {
            currentBookmarks = children;
            displayFilteredBookmarks(currentBookmarks);
        });
    }

    // 显示过滤后的书签
    function displayFilteredBookmarks(bookmarks) {
        const sortedBookmarks = sortBookmarks(bookmarks, sortSelect.value);
        bookmarkList.innerHTML = '';
        sortedBookmarks.forEach(function (bookmark, index) {
            if (bookmark.url) {
                const bookmarkItem = document.createElement('li');
                bookmarkItem.style.animationDelay = `${index * 0.05}s`;

                // 添加拖拽属性
                bookmarkItem.draggable = true;
                bookmarkItem.dataset.index = index;
                bookmarkItem.dataset.id = bookmark.id;

                // 添加拖动手柄
                const dragHandle = document.createElement('span');
                dragHandle.className = 'drag-handle';
                dragHandle.textContent = '⋮⋮';

                // 添加编辑按钮
                const editBtn = document.createElement('button');
                editBtn.className = 'edit-btn';
                editBtn.innerHTML = '✏️';
                editBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showEditModal(bookmark);
                });

                // 添加删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.innerHTML = '🗑️';
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteBookmark(bookmark.id);
                });

                const link = document.createElement('a');
                link.href = bookmark.url;
                link.target = '_blank';

                // 创建 emoji 容器
                const emojiContainer = document.createElement('div');
                emojiContainer.className = 'bookmark-emoji';
                emojiContainer.textContent = getEmojiForUrl(bookmark.url);

                // 创建标题元素
                const title = document.createElement('div');
                title.className = 'bookmark-title';
                title.textContent = bookmark.title;

                // 创建 URL 元素
                const url = document.createElement('div');
                url.className = 'bookmark-url';
                url.textContent = new URL(bookmark.url).hostname;

                // 组装卡片
                link.appendChild(emojiContainer);
                link.appendChild(title);
                link.appendChild(url);
                bookmarkItem.appendChild(dragHandle);
                bookmarkItem.appendChild(editBtn);
                bookmarkItem.appendChild(deleteBtn);
                bookmarkItem.appendChild(link);
                bookmarkList.appendChild(bookmarkItem);

                // 添加拖拽事件监听器
                bookmarkItem.addEventListener('dragstart', handleDragStart);
                bookmarkItem.addEventListener('dragend', handleDragEnd);
                bookmarkItem.addEventListener('dragover', handleDragOver);
                bookmarkItem.addEventListener('drop', handleDrop);

                // 修改书签点击事件，记录访问次数
                link.addEventListener('click', () => {
                    recordVisit(bookmark.url);
                });
            }
        });
    }

    // 拖拽事件处理函数
    function handleDragStart(e) {
        draggedItem = this;
        draggedIndex = parseInt(this.dataset.index);
        this.classList.add('dragging');

        // 设置拖动效果
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.id);
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        document.querySelectorAll('#bookmark-list li').forEach(item => {
            item.classList.remove('drag-over');
        });
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const targetItem = this;
        if (targetItem !== draggedItem) {
            targetItem.classList.add('drag-over');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const targetItem = this;
        targetItem.classList.remove('drag-over');

        if (targetItem !== draggedItem) {
            const targetIndex = parseInt(targetItem.dataset.index);
            const currentFolder = document.querySelector('#folder-list li.active');

            if (currentFolder) {
                // 当前文件夹的所有签
                chrome.bookmarks.getChildren(currentFolder.dataset.folderId, function (children) {
                    // 计算新的索引
                    const newIndex = targetIndex > draggedIndex ? targetIndex + 1 : targetIndex;

                    // 移动书签
                    chrome.bookmarks.move(draggedItem.dataset.id, {
                        parentId: currentFolder.dataset.folderId,
                        index: newIndex
                    }, function () {
                        // 重新加载书签列表
                        displayBookmarks(currentFolder.dataset.folderId);
                    });
                });
            }
        }
    }

    // 搜索功能
    searchBar.addEventListener('input', function (e) {
        const query = e.target.value.toLowerCase();

        if (isGlobalSearch) {
            // 全局搜索
            chrome.bookmarks.search(query, function (results) {
                // 只显示带 URL 的书签，过滤掉文件夹
                const filteredResults = results.filter(bookmark => bookmark.url);
                displayFilteredBookmarks(filteredResults);
            });
        } else {
            // 当前文件夹内搜索
            const filteredBookmarks = currentBookmarks.filter(bookmark =>
                bookmark.title.toLowerCase().includes(query) ||
                bookmark.url.toLowerCase().includes(query)
            );
            displayFilteredBookmarks(filteredBookmarks);
        }
    });

    // 简文件夹列表初始化函数
    function initializeFolderList() {
        chrome.bookmarks.getChildren('1', function (children) {
            folderList.innerHTML = '';
            children.forEach(function (bookmark) {
                if (bookmark.url === undefined) {
                    const folderItem = document.createElement('li');

                    // 创建文件夹名称容器
                    const folderName = document.createElement('div');
                    folderName.className = 'folder-name';
                    folderName.textContent = bookmark.title;

                    folderItem.dataset.folderId = bookmark.id;
                    folderItem.appendChild(folderName);

                    folderItem.addEventListener('click', function () {
                        displayBookmarks(bookmark.id);
                    });

                    folderList.appendChild(folderItem);
                }
            });
        });
    }

    // 在 DOMContentLoaded 事件监听器内，initializeFolderList() 之前添加
    function initializeGlobalSearch() {
        isGlobalSearch = true;
        
        // 清空当前书签列表和搜索框
        currentBookmarks = [];
        bookmarkList.innerHTML = '';
        searchBar.value = '';
        
        // 更新搜索框提示
        searchBar.placeholder = getMessage('searchAllPlaceholder');
        
        // 隐藏排序选项
        document.querySelector('.sort-options').classList.remove('show');
        
        // 显示欢迎提示
        const welcomeToast = document.querySelector('.welcome-toast');
        const welcomeEmoji = welcomeToast.querySelector('.welcome-emoji');
        const welcomeTitle = welcomeToast.querySelector('.welcome-text');
        const welcomeSubtext = welcomeToast.querySelector('.welcome-subtext');
        
        // 设置国际化文本
        welcomeTitle.textContent = getMessage('welcomeTitle');
        welcomeSubtext.textContent = getMessage('welcomeSubtext');
        
        // 随机选择欢迎 emoji
        const welcomeEmojis = ['✨', '🚀', '🌟', '💫', '🎉', '🎊', '🌈', '💝'];
        welcomeEmoji.textContent = welcomeEmojis[Math.floor(Math.random() * welcomeEmojis.length)];
        
        // 添加动画类
        welcomeEmoji.classList.remove('welcome-emoji-animation');
        void welcomeEmoji.offsetWidth; // 触发重绘
        welcomeEmoji.classList.add('welcome-emoji-animation');
        
        // 显示提示框
        welcomeToast.classList.add('show');
        
        // 3秒后自动隐藏
        setTimeout(() => {
            welcomeToast.classList.remove('show');
        }, 3000);
        
        // 聚焦搜索框
        setTimeout(() => {
            searchBar.focus();
        }, 500);
    }

    // 修改初始化顺序
    initializeGlobalSearch();  // 先初始化全局搜索
    initializeFolderList();    // 再初始化文件夹列表

    // 显示编辑模态
    function showEditModal(bookmark) {
        currentEditingBookmark = bookmark;
        editTitleInput.value = bookmark.title;
        editUrlInput.value = bookmark.url;
        editModal.style.display = 'block';
        document.querySelector('.edit-modal h3').textContent = getMessage('editBookmark');
    }

    // 保存编辑
    function saveEdit() {
        if (!currentEditingBookmark) return;

        chrome.bookmarks.update(currentEditingBookmark.id, {
            title: editTitleInput.value,
            url: editUrlInput.value
        }, () => {
            // 更新成功后刷新显示
            const currentFolder = document.querySelector('#folder-list li.active');
            if (currentFolder) {
                displayBookmarks(currentFolder.dataset.folderId);
            }
            editModal.style.display = 'none';
        });
    }

    // 添加事件监听器
    saveEditBtn.addEventListener('click', saveEdit);
    cancelEditBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.style.display = 'none';
        }
    });

    // 添加返回顶部功能
    const backToTopBtn = document.getElementById('back-to-top');
    const mainContent = document.getElementById('main-content');

    // 监听滚动事件
    mainContent.addEventListener('scroll', function () {
        // 当滚动超过 300px 时显示按钮
        if (mainContent.scrollTop > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    // 点击返回顶部
    backToTopBtn.addEventListener('click', function () {
        // 使用平滑滚动效果
        mainContent.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // 修改 logo 点击事件
    document.querySelector('#sidebar .emoji').addEventListener('click', function () {
        isGlobalSearch = true;

        // 移除所有文件夹的活动状态
        document.querySelectorAll('#folder-list li').forEach(item => {
            item.classList.remove('active');
        });

        // 清空当前书签列表和搜索框
        currentBookmarks = [];
        bookmarkList.innerHTML = '';
        searchBar.value = '';

        // 更新搜索框提示 - 使用国际化消息
        searchBar.placeholder = getMessage('searchAllPlaceholder');

        // 隐藏排序选项
        document.querySelector('.sort-options').classList.remove('show');

        // 显示欢迎提示
        const welcomeToast = document.querySelector('.welcome-toast');
        const welcomeEmoji = welcomeToast.querySelector('.welcome-emoji');
        const welcomeTitle = welcomeToast.querySelector('.welcome-text');
        const welcomeSubtext = welcomeToast.querySelector('.welcome-subtext');

        // 设置国际化文本
        welcomeTitle.textContent = getMessage('welcomeTitle');
        welcomeSubtext.textContent = getMessage('welcomeSubtext');

        // 随机选择欢迎 emoji
        const welcomeEmojis = ['✨', '🚀', '🌟', '💫', '🎉', '🎊', '🌈', '💝'];
        welcomeEmoji.textContent = welcomeEmojis[Math.floor(Math.random() * welcomeEmojis.length)];

        // 添加动画类
        welcomeEmoji.classList.remove('welcome-emoji-animation');
        void welcomeEmoji.offsetWidth; // 触发重绘
        welcomeEmoji.classList.add('welcome-emoji-animation');

        // 显示提示框
        welcomeToast.classList.add('show');

        // 3秒后自动隐藏
        setTimeout(() => {
            welcomeToast.classList.remove('show');
        }, 3000);

        // 聚焦搜索框
        setTimeout(() => {
            searchBar.focus();
        }, 500);
    });

    // 修改搜索框失焦事件
    searchBar.addEventListener('blur', function () {
        if (isGlobalSearch && !this.value) {
            // 如果是全局搜索模式搜索框为空，保持白状态
            bookmarkList.innerHTML = '';
        }
    });

    // 只保留一个排序事件监听器
    sortSelect.addEventListener('change', function () {
        displayFilteredBookmarks(currentBookmarks);
    });

    // 点击显示/隐藏下拉菜单
    selectSelected.addEventListener('click', function (e) {
        e.stopPropagation();
        this.parentElement.querySelector('.select-items').classList.toggle('select-show');
        this.classList.toggle('select-arrow-active');
    });

    // 点击选项时
    document.querySelectorAll('.select-items div').forEach(item => {
        item.addEventListener('click', function (e) {
            e.stopPropagation();
            const value = this.getAttribute('data-value');
            selectSelected.innerHTML = this.innerHTML;
            sortSelect.value = value;
            selectItems.classList.remove('select-show');

            // 触发 change 事件
            sortSelect.dispatchEvent(new Event('change'));
        });
    });

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', function () {
        selectItems.classList.remove('select-show');
        selectSelected.classList.remove('select-arrow-active');
    });

    // 在 DOMContentLoaded 事件监听器内添加
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('.theme-icon');

    // 从 storage 加载主题设置
    chrome.storage.sync.get(['darkMode'], function (result) {
        if (result.darkMode) {
            document.body.classList.add('dark-mode');
            themeIcon.textContent = '🌜';
        }
    });

    // 切换主题
    themeToggle.addEventListener('click', function () {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        themeIcon.textContent = isDarkMode ? '🌜' : '🌞';

        // 保存主题设置
        chrome.storage.sync.set({ darkMode: isDarkMode });

        // 添加过渡动画类
        document.body.classList.add('theme-transition');
        setTimeout(() => {
            document.body.classList.remove('theme-transition');
        }, 1000);
    });

    // 添加删除书签函数
    function deleteBookmark(bookmarkId) {
        if (confirm(getMessage('deleteConfirm'))) {
            chrome.bookmarks.remove(bookmarkId, () => {
                // 删除成功后刷新当前文件夹
                const currentFolder = document.querySelector('#folder-list li.active');
                if (currentFolder) {
                    displayBookmarks(currentFolder.dataset.folderId);
                }
            });
        }
    }

    // 添加国际化支持函数
    function getMessage(key) {
        return chrome.i18n.getMessage(key);
    }

    // 初始化页面文本
    function initializeI18n() {
        document.getElementById('bookmarks-title').textContent = getMessage('myBookmarks');
        document.getElementById('search-bar').placeholder = getMessage('searchPlaceholder');
        document.getElementById('sort-default').textContent = getMessage('sortDefault');

        // 添加导入导出按钮的文本
        document.getElementById('export-text').textContent = getMessage('exportButton');
        document.getElementById('import-text').textContent = getMessage('importButton');

        // 更新排序选项
        const sortOptions = {
            'default': getMessage('sortDefault'),
            'frequency': getMessage('sortMostVisited'),
            'domain': getMessage('sortByDomain'),
            'title': getMessage('sortByTitle'),
            'date': getMessage('sortByDate')
        };

        // 更新排序选项的显示文本
        document.querySelectorAll('.select-items div').forEach(div => {
            const value = div.getAttribute('data-value');
            const text = sortOptions[value];
            const icon = div.querySelector('.option-icon').outerHTML;
            div.innerHTML = icon + text;
        });
    }

    // 初始化国际化
    initializeI18n();

    // 在适当的位置添加语言切换功能
    function switchLanguage(lang) {
        chrome.storage.sync.set({ language: lang }, function () {
            // 重新加载页面以应用新语言
            window.location.reload();
        });
    }

    // 从存储中获取语言设置
    chrome.storage.sync.get(['language'], function (result) {
        if (result.language) {
            document.documentElement.lang = result.language;
        }
    });

    // 在 DOMContentLoaded 事件监听器内添加
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    // 导出功能
    exportBtn.addEventListener('click', function () {
        // 获取所有书签
        chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
            // 准备导出数据
            const exportData = {
                bookmarks: bookmarkTreeNodes,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };

            // 创建下载
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bookmarks_export_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    });

    // 导入按钮点击事件
    importBtn.addEventListener('click', function () {
        importFile.click();
    });

    // 处理文件导入
    importFile.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const importData = JSON.parse(e.target.result);

                // 验证导入数据格式
                if (!importData.bookmarks || !Array.isArray(importData.bookmarks)) {
                    throw new Error('Invalid bookmark data format');
                }

                // 确认导入
                if (confirm(getMessage('importConfirm'))) {
                    importBookmarks(importData.bookmarks[0]);
                }
            } catch (error) {
                alert(getMessage('importError'));
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    });

    // 递归导入书签
    function importBookmarks(node, parentId = null) {
        if (node.url) {
            // 创建书签
            chrome.bookmarks.create({
                parentId: parentId,
                title: node.title,
                url: node.url
            });
        } else if (node.children) {
            // 创建文件夹
            chrome.bookmarks.create({
                parentId: parentId,
                title: node.title || 'Imported Folder'
            }, function (newFolder) {
                // 递归处理子项
                node.children.forEach(child => {
                    importBookmarks(child, newFolder.id);
                });
            });
        }
    }
});
