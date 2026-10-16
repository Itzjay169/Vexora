import 'package:flutter/material.dart';

/// Vexora Esports Tournament Platform — Inbox Screen
///
/// Phase 30: Push Notifications, Inbox & Announcements
/// PDF refs: Sections 20, 39 (Phase 7)
///
/// Features:
/// - In-app notification inbox with category filters
/// - Deep-link routing to match/tournament/dispute
/// - Category filter chips with badge counts
/// - Quiet hours settings
/// - Mandatory SECURITY notification lock indicator
/// - Pull-to-refresh and lazy loading

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  String _activeFilter = 'ALL';
  bool _showPreferences = false;

  // Mock notification data
  final List<Map<String, dynamic>> _notifications = [
    {
      'id': 'n-001',
      'category': 'SECURITY',
      'title': 'New device login detected',
      'body':
          'Your account was accessed from a new Android device. If this wasn\'t you, secure your account immediately.',
      'deep_link': 'vexora://settings/security',
      'is_read': false,
      'is_mutable': false,
      'created_at': DateTime.now().subtract(const Duration(minutes: 30)),
    },
    {
      'id': 'n-002',
      'category': 'TOURNAMENT',
      'title': 'Registration confirmed: BGMI Pro League',
      'body':
          'You have been confirmed for the BGMI Pro League tournament. Check-in starts at 7:30 PM IST.',
      'deep_link': 'vexora://tournaments/bgmi-pro-league',
      'is_read': false,
      'is_mutable': true,
      'created_at': DateTime.now().subtract(const Duration(hours: 2)),
    },
    {
      'id': 'n-003',
      'category': 'MATCH',
      'title': 'Match starting in 15 minutes',
      'body':
          'Your Round 2 match in the BGMI Pro League is about to begin. Check in and join the lobby.',
      'deep_link': 'vexora://matches/match-r2-001',
      'is_read': false,
      'is_mutable': true,
      'created_at': DateTime.now().subtract(const Duration(hours: 3)),
    },
    {
      'id': 'n-004',
      'category': 'ANNOUNCEMENT',
      'title': 'Free Fire MAX Weekly Series — Registration Open',
      'body':
          'Registration is now open for the weekly Free Fire MAX tournament. 64 slots available.',
      'deep_link': 'vexora://tournaments/freefire-weekly',
      'is_read': true,
      'is_mutable': true,
      'created_at': DateTime.now().subtract(const Duration(hours: 5)),
    },
    {
      'id': 'n-005',
      'category': 'DISPUTE',
      'title': 'Dispute resolved in your favour',
      'body':
          'The dispute for Match #R1-004 has been resolved. The decision was made in your favour.',
      'deep_link': 'vexora://disputes/disp-001',
      'is_read': true,
      'is_mutable': true,
      'created_at': DateTime.now().subtract(const Duration(hours: 8)),
    },
    {
      'id': 'n-006',
      'category': 'WALLET',
      'title': 'Credits received',
      'body': 'You received a credit reward. Check your wallet for details.',
      'deep_link': 'vexora://wallet',
      'is_read': true,
      'is_mutable': true,
      'created_at': DateTime.now().subtract(const Duration(hours: 12)),
    },
  ];

  static const Map<String, Map<String, dynamic>> _categoryConfig = {
    'SECURITY': {'icon': Icons.lock, 'color': 0xFFEF4444, 'label': 'Security'},
    'TOURNAMENT': {
      'icon': Icons.emoji_events,
      'color': 0xFFF59E0B,
      'label': 'Tournament',
    },
    'MATCH': {'icon': Icons.sports_esports, 'color': 0xFF3B82F6, 'label': 'Match'},
    'DISPUTE': {'icon': Icons.gavel, 'color': 0xFFA855F7, 'label': 'Dispute'},
    'WALLET': {
      'icon': Icons.account_balance_wallet,
      'color': 0xFF10B981,
      'label': 'Wallet',
    },
    'ANNOUNCEMENT': {
      'icon': Icons.campaign,
      'color': 0xFF6366F1,
      'label': 'Announcement',
    },
    'SOCIAL': {'icon': Icons.people, 'color': 0xFFEC4899, 'label': 'Social'},
    'SYSTEM': {'icon': Icons.settings, 'color': 0xFF64748B, 'label': 'System'},
  };

  List<Map<String, dynamic>> get _filteredNotifications {
    if (_activeFilter == 'ALL') return _notifications;
    return _notifications.where((n) => n['category'] == _activeFilter).toList();
  }

  int get _unreadCount => _notifications.where((n) => !n['is_read']).length;

  void _markAsRead(String id) {
    setState(() {
      final idx = _notifications.indexWhere((n) => n['id'] == id);
      if (idx >= 0) _notifications[idx]['is_read'] = true;
    });
  }

  void _markAllRead() {
    setState(() {
      for (final n in _notifications) {
        n['is_read'] = true;
      }
    });
  }

  void _archiveNotification(String id) {
    setState(() {
      _notifications.removeWhere((n) => n['id'] == id);
    });
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: Row(
          children: [
            const Text(
              'Inbox',
              style: TextStyle(
                color: Color(0xFFF8FAFC),
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (_unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$_unreadCount',
                  style: const TextStyle(
                    color: Color(0xFFEF4444),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              _showPreferences ? Icons.settings : Icons.settings_outlined,
              color: _showPreferences
                  ? const Color(0xFF6366F1)
                  : const Color(0xFF94A3B8),
              size: 22,
            ),
            onPressed: () =>
                setState(() => _showPreferences = !_showPreferences),
            tooltip: 'Notification Preferences',
          ),
          PopupMenuButton<String>(
            icon:
                const Icon(Icons.more_vert, color: Color(0xFF94A3B8), size: 22),
            color: const Color(0xFF1E293B),
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'mark_all',
                child: Text('Mark All Read',
                    style: TextStyle(color: Color(0xFFF8FAFC), fontSize: 14)),
              ),
            ],
            onSelected: (value) {
              if (value == 'mark_all') _markAllRead();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          // Simulated pull-to-refresh
          await Future.delayed(const Duration(seconds: 1));
        },
        color: const Color(0xFF6366F1),
        child: CustomScrollView(
          slivers: [
            // Preferences panel
            if (_showPreferences)
              SliverToBoxAdapter(
                child: _buildPreferencesPanel(),
              ),

            // Category filter chips
            SliverToBoxAdapter(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _buildFilterChip('ALL', 'All', null, 0xFF6366F1),
                      ..._categoryConfig.entries.map((e) => _buildFilterChip(
                            e.key,
                            e.value['label'] as String,
                            e.value['icon'] as IconData,
                            e.value['color'] as int,
                          )),
                    ],
                  ),
                ),
              ),
            ),

            // Notification list
            if (_filteredNotifications.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.notifications_off_outlined,
                          size: 48, color: Colors.white.withOpacity(0.2)),
                      const SizedBox(height: 12),
                      const Text(
                        'No notifications',
                        style:
                            TextStyle(color: Color(0xFF64748B), fontSize: 16),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final notif = _filteredNotifications[index];
                    return _buildNotificationTile(notif);
                  },
                  childCount: _filteredNotifications.length,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(
      String key, String label, IconData? icon, int colorValue) {
    final isActive = _activeFilter == key;
    final color = Color(colorValue);

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: () => setState(() => _activeFilter = key),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isActive ? color.withOpacity(0.15) : Colors.transparent,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isActive ? color : const Color(0xFF1E293B),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 14, color: isActive ? color : const Color(0xFF64748B)),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isActive ? color : const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNotificationTile(Map<String, dynamic> notif) {
    final cat = _categoryConfig[notif['category']] ?? _categoryConfig['SYSTEM']!;
    final color = Color(cat['color'] as int);
    final isRead = notif['is_read'] as bool;
    final isMutable = notif['is_mutable'] as bool;

    return Dismissible(
      key: Key(notif['id']),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => _archiveNotification(notif['id']),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: const Color(0xFFEF4444).withOpacity(0.2),
        child: const Icon(Icons.delete_outline, color: Color(0xFFEF4444)),
      ),
      child: GestureDetector(
        onTap: () {
          _markAsRead(notif['id']);
          // Deep link routing would happen here
        },
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isRead
                ? const Color(0xFF0F172A)
                : const Color(0xFF111827),
            borderRadius: BorderRadius.circular(10),
            border: Border(
              left: BorderSide(
                color: isRead ? const Color(0xFF1E293B) : color,
                width: 3,
              ),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Category icon
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  cat['icon'] as IconData,
                  size: 18,
                  color: color,
                ),
              ),
              const SizedBox(width: 12),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notif['title'],
                            style: TextStyle(
                              color: const Color(0xFFF8FAFC),
                              fontSize: 14,
                              fontWeight: isRead ? FontWeight.w400 : FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (!isMutable)
                          Container(
                            margin: const EdgeInsets.only(left: 6),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color:
                                  const Color(0xFFEF4444).withOpacity(0.15),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'MANDATORY',
                              style: TextStyle(
                                color: Color(0xFFEF4444),
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        if (!isRead)
                          Container(
                            margin: const EdgeInsets.only(left: 6),
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      notif['body'],
                      style: TextStyle(
                        color: const Color(0xFF94A3B8),
                        fontSize: 13,
                        height: 1.4,
                        fontWeight: FontWeight.w400,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'View details →',
                          style: TextStyle(
                            color: const Color(0xFF818CF8),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        Text(
                          _timeAgo(notif['created_at'] as DateTime),
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPreferencesPanel() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Notification Preferences',
            style: TextStyle(
              color: Color(0xFFF8FAFC),
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          ..._categoryConfig.entries.map((e) {
            final isSecurityLocked = e.key == 'SECURITY';
            final color = Color(e.value['color'] as int);
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF1E293B)),
              ),
              child: Row(
                children: [
                  Icon(e.value['icon'] as IconData,
                      size: 18, color: color),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      e.value['label'] as String,
                      style: const TextStyle(
                        color: Color(0xFFF8FAFC),
                        fontSize: 14,
                      ),
                    ),
                  ),
                  if (isSecurityLocked)
                    Container(
                      margin: const EdgeInsets.only(right: 8),
                      child: const Text(
                        'LOCKED',
                        style: TextStyle(
                          color: Color(0xFFEF4444),
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  Switch(
                    value: true,
                    onChanged: isSecurityLocked ? null : (val) {},
                    activeColor: const Color(0xFF6366F1),
                    inactiveTrackColor: const Color(0xFF334155),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.lock_outline,
                  size: 14, color: Color(0xFF64748B)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Security notifications cannot be disabled. Mandatory for account safety.',
                  style: TextStyle(
                    color: const Color(0xFF64748B),
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
