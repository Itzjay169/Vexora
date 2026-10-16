import 'package:flutter/material.dart';

/// Vexora — Support Desk & Ticketing Screen
///
/// Phase 33: Support Desk
/// PDF refs: Sections 23, 39 (Phase 8), ADR-014
///
/// Features:
/// - Ticket list with category, status, and SLA tracking
/// - 1-Hour Emergency SLA badge for Safety & Harassment reports
/// - Ticket creation with category selection
/// - Conversation thread with reply capability
/// - Post-resolution CSAT satisfaction survey (1-5 stars)
/// - Statutory Grievance Redressal information (ADR-014)

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const Map<String, Color> _categoryColors = {
    'SAFETY': Color(0xFFEF4444),
    'PAYMENT': Color(0xFFF59E0B),
    'WALLET': Color(0xFFEAB308),
    'PAYOUT': Color(0xFFA855F7),
    'TOURNAMENT': Color(0xFF3B82F6),
    'MATCH': Color(0xFF06B6D4),
    'ACCOUNT': Color(0xFF10B981),
    'ORGANISER': Color(0xFF8B5CF6),
  };

  static const Map<String, Color> _statusColors = {
    'OPEN': Color(0xFF3B82F6),
    'IN_PROGRESS': Color(0xFFA855F7),
    'WAITING_USER': Color(0xFFF59E0B),
    'ESCALATED': Color(0xFFEF4444),
    'RESOLVED': Color(0xFF10B981),
    'CLOSED': Color(0xFF64748B),
  };

  final List<Map<String, dynamic>> _tickets = [
    {
      'id': 'tk-1',
      'ticket_number': 'VEX-TK-10023',
      'category': 'SAFETY',
      'subject': 'Verbal harassment in match #892 voice lobby',
      'status': 'ESCALATED',
      'priority': 'CRITICAL',
      'sla_first_response': '1h Fast SLA (Safety)',
      'created_at': 'Today, 11:00 AM',
      'messages': [
        {
          'sender': 'You',
          'is_user': true,
          'message': 'Opposing captain was abusive in pre-match lobby.',
          'time': '11:00 AM',
        },
        {
          'sender': 'Support Agent Sarah',
          'is_user': false,
          'message': 'Your report has been escalated to 24/7 Moderation under our 1-hour safety SLA.',
          'time': '11:20 AM',
        },
      ],
      'csat_submitted': false,
    },
    {
      'id': 'tk-2',
      'ticket_number': 'VEX-TK-10024',
      'category': 'TOURNAMENT',
      'subject': 'Lobby room code expired before match start',
      'status': 'OPEN',
      'priority': 'HIGH',
      'sla_first_response': '4h Standard SLA',
      'created_at': 'Today, 11:15 AM',
      'messages': [
        {
          'sender': 'You',
          'is_user': true,
          'message': 'Room code given on tournament screen was invalid.',
          'time': '11:15 AM',
        },
      ],
      'csat_submitted': false,
    },
    {
      'id': 'tk-3',
      'ticket_number': 'VEX-TK-10020',
      'category': 'ACCOUNT',
      'subject': 'In-game UID update request for BGMI',
      'status': 'RESOLVED',
      'priority': 'MEDIUM',
      'sla_first_response': '4h Standard SLA',
      'created_at': '2 days ago',
      'messages': [
        {
          'sender': 'You',
          'is_user': true,
          'message': 'Changed my in-game nickname and need UID re-linked.',
          'time': 'Oct 14',
        },
        {
          'sender': 'Support Agent Rahul',
          'is_user': false,
          'message': 'Your BGMI UID has been verified and updated in your profile.',
          'time': 'Oct 14',
        },
      ],
      'csat_submitted': true,
      'csat_rating': 5,
    },
  ];

  // New ticket form state
  String _selectedCategory = 'SAFETY';
  String _selectedPriority = 'MEDIUM';
  final _subjectController = TextEditingController();
  final _descController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _subjectController.dispose();
    _descController.dispose();
    super.dispose();
  }

  void _submitTicket() {
    if (_subjectController.text.trim().isEmpty || _descController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill out both subject and description')),
      );
      return;
    }

    final newTicketNumber = 'VEX-TK-${10000 + _tickets.length + 1}';
    final isSafety = _selectedCategory == 'SAFETY';

    setState(() {
      _tickets.insert(0, {
        'id': 'tk-${DateTime.now().millisecondsSinceEpoch}',
        'ticket_number': newTicketNumber,
        'category': _selectedCategory,
        'subject': _subjectController.text.trim(),
        'status': 'OPEN',
        'priority': _selectedPriority,
        'sla_first_response': isSafety ? '1h Fast SLA (Safety)' : '4h Standard SLA',
        'created_at': 'Just now',
        'messages': [
          {
            'sender': 'You',
            'is_user': true,
            'message': _descController.text.trim(),
            'time': 'Just now',
          },
        ],
        'csat_submitted': false,
      });
      _subjectController.clear();
      _descController.clear();
      _tabController.animateTo(0);
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Ticket $newTicketNumber submitted with active SLA tracking!'),
        backgroundColor: const Color(0xFF10B981),
      ),
    );
  }

  void _openTicketDetails(Map<String, dynamic> ticket) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF111827),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _TicketDetailSheet(ticket: ticket),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Support Desk', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF111827),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF3B82F6),
          tabs: [
            Tab(text: 'My Tickets (${_tickets.length})'),
            const Tab(text: 'New Ticket'),
            const Tab(text: 'Help & Grievance'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildMyTicketsTab(),
          _buildNewTicketTab(),
          _buildHelpTab(),
        ],
      ),
    );
  }

  Widget _buildMyTicketsTab() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _tickets.length,
      itemBuilder: (context, index) {
        final ticket = _tickets[index];
        final catColor = _categoryColors[ticket['category']] ?? Colors.grey;
        final statColor = _statusColors[ticket['status']] ?? Colors.grey;
        final isSafety = ticket['category'] == 'SAFETY';

        return Card(
          color: const Color(0xFF1E293B),
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(
              color: isSafety ? Colors.red.withOpacity(0.4) : Colors.transparent,
              width: 1,
            ),
          ),
          child: InkWell(
            onTap: () => _openTicketDetails(ticket),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        ticket['ticket_number'],
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: catColor.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              ticket['category'],
                              style: TextStyle(color: catColor, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: statColor.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              ticket['status'],
                              style: TextStyle(color: statColor, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    ticket['subject'],
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        ticket['created_at'],
                        style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      ),
                      Text(
                        ticket['sla_first_response'],
                        style: TextStyle(
                          color: isSafety ? const Color(0xFFEF4444) : const Color(0xFF38BDF8),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildNewTicketTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Emergency 1h Safety SLA banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.red.withOpacity(0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.shield, color: Color(0xFFEF4444), size: 24),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Safety & Harassment reports receive expedited 1-Hour First Response under Vexora Fair Play rules.',
                    style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text('Category', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: _selectedCategory,
            dropdownColor: const Color(0xFF1E293B),
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFF1E293B),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            ),
            items: _categoryColors.keys.map((cat) {
              return DropdownMenuItem(value: cat, child: Text(cat));
            }).toList(),
            onChanged: (val) => setState(() => _selectedCategory = val!),
          ),
          const SizedBox(height: 16),
          const Text('Subject', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: _subjectController,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Brief summary of the issue',
              hintStyle: const TextStyle(color: Color(0xFF64748B)),
              filled: true,
              fillColor: const Color(0xFF1E293B),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 16),
          const Text('Description', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: _descController,
            maxLines: 4,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Provide details, match IDs, or player usernames...',
              hintStyle: const TextStyle(color: Color(0xFF64748B)),
              filled: true,
              fillColor: const Color(0xFF1E293B),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _submitTicket,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF3B82F6),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Submit Ticket', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHelpTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: const Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.gavel, color: Color(0xFF38BDF8), size: 20),
                    SizedBox(width: 8),
                    Text('Resident Grievance Officer', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                  ],
                ),
                SizedBox(height: 8),
                Text(
                  'Under IT Rules 2021 (India), statutory grievances are processed with maximum 4-hour receipt acknowledgment and 72-hour resolution.',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, height: 1.4),
                ),
                SizedBox(height: 10),
                Text('Email: grievance@vexora.gg', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 13, fontWeight: FontWeight.w600)),
                Text('Office: Bengaluru 560001, Karnataka, India', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          color: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: const Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Operational Service Level Agreements (SLAs)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                SizedBox(height: 10),
                _SlaRow(label: 'Safety / Harassment', value: '1 Hour First Response'),
                _SlaRow(label: 'Critical Tournament Blocker', value: '2 Hours First Response'),
                _SlaRow(label: 'Standard Account / Match', value: '4 Hours First Response'),
                _SlaRow(label: 'General Inquiries', value: '8 Hours First Response'),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SlaRow extends StatelessWidget {
  final String label;
  final String value;
  const _SlaRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
          Text(value, style: const TextStyle(color: Color(0xFF10B981), fontSize: 13, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _TicketDetailSheet extends StatefulWidget {
  final Map<String, dynamic> ticket;
  const _TicketDetailSheet({required this.ticket});

  @override
  State<_TicketDetailSheet> createState() => _TicketDetailSheetState();
}

class _TicketDetailSheetState extends State<_TicketDetailSheet> {
  final _replyController = TextEditingController();
  int _csatRating = 5;

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  void _sendReply() {
    final text = _replyController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      final messages = widget.ticket['messages'] as List;
      messages.add({
        'sender': 'You',
        'is_user': true,
        'message': text,
        'time': 'Just now',
      });
      _replyController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final ticket = widget.ticket;
    final messages = ticket['messages'] as List;
    final isResolved = ticket['status'] == 'RESOLVED' || ticket['status'] == 'CLOSED';

    return Padding(
      padding: EdgeInsets.only(
        top: 20,
        left: 16,
        right: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  ticket['ticket_number'],
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.grey),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            Text(
              ticket['subject'],
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
            ),
            const Divider(color: Color(0xFF1E293B), height: 24),

            // Messages thread
            Expanded(
              child: ListView.builder(
                itemCount: messages.length,
                itemBuilder: (context, idx) {
                  final m = messages[idx];
                  final isUser = m['is_user'] == true;
                  return Align(
                    alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                      decoration: BoxDecoration(
                        color: isUser ? const Color(0xFF3B82F6) : const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            m['sender'],
                            style: TextStyle(
                              color: isUser ? Colors.white70 : const Color(0xFF38BDF8),
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            m['message'],
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            // CSAT Survey prompt if ticket resolved
            if (isResolved && ticket['csat_submitted'] != true) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                ),
                child: Column(
                  children: [
                    const Text('How was our support?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (i) {
                        return IconButton(
                          icon: Icon(
                            i < _csatRating ? Icons.star : Icons.star_border,
                            color: const Color(0xFFF59E0B),
                          ),
                          onPressed: () => setState(() => _csatRating = i + 1),
                        );
                      }),
                    ),
                    ElevatedButton(
                      onPressed: () {
                        setState(() => ticket['csat_submitted'] = true);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Thank you for rating our support!')),
                        );
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                      child: const Text('Submit Rating'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],

            // Reply input
            if (!isResolved)
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _replyController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        hintText: 'Type your reply...',
                        hintStyle: const TextStyle(color: Color(0xFF64748B)),
                        filled: true,
                        fillColor: const Color(0xFF1E293B),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.send, color: Color(0xFF3B82F6)),
                    onPressed: _sendReply,
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
