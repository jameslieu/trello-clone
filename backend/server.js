const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { parse } = require('csv-parse/sync'); // Ensure both parse and stringify are imported
const { stringify } = require('csv-stringify/sync');
const app = express();
const port = 5000;
const ticketsFilePath = path.join(__dirname, 'tickets.csv');

app.use(cors());
app.use(express.json());

// Helper function to read tickets from CSV
const readTickets = async () => {
  try {
    const fileContent = await fs.readFile(ticketsFilePath, 'utf-8');
    if (!fileContent.trim()) {
      // If the file is empty, return an empty array
      return [];
    }
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (context.column === 'order') {
          return parseInt(value, 10);
        }
        if (context.column === 'comments' || context.column === 'history') {
          return value ? JSON.parse(value) : [];
        }
        return value;
      },
    });
    return records;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // If file doesn't exist, return an empty array
      return [];
    }
    throw error;
  }
};

// Helper function to write tickets to CSV
const writeTickets = async (tickets) => {
  try {
    const csv = stringify(tickets, {
      header: true,
      columns: [
        'id',
        'title',
        'description',
        'status',
        'priority',
        'assignee',
        'sprint',
        'order',
        'createdAt',
        'updatedAt',
        'comments',
        'history',
      ],
      cast: {
        object: (value) => JSON.stringify(value),
      },
    });
    await fs.writeFile(ticketsFilePath, csv, 'utf-8');
  } catch (error) {
    console.error('Error in writeTickets:', error);
    throw error;
  }
};

// GET all tickets with pagination
app.get('/tickets', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const tickets = await readTickets();
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTickets = tickets.slice(startIndex, endIndex);

    res.json({
      tickets: paginatedTickets,
      total: tickets.length,
      page: parseInt(page),
      totalPages: Math.ceil(tickets.length / limit),
    });
  } catch (error) {
    console.error('Error in GET /tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// POST a new ticket
app.post('/tickets', async (req, res) => {
  try {
    const tickets = await readTickets();
    const newTicket = {
      id: String(tickets.length + 1),
      title: req.body.title,
      description: req.body.description,
      status: 'ToDo',
      priority: req.body.priority || 'Medium',
      assignee: req.body.assignee || '',
      sprint: req.body.sprint || 'Sprint 1',
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
      history: [{ action: 'Created', timestamp: new Date().toISOString() }],
    };

    tickets.push(newTicket);
    await writeTickets(tickets);
    res.status(201).json(newTicket);
  } catch (error) {
    console.error('Error in POST /tickets:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// PUT to update a ticket
app.put('/tickets/:id', async (req, res) => {
  try {
    const tickets = await readTickets();
    const ticketIndex = tickets.findIndex((ticket) => ticket.id === req.params.id);
    if (ticketIndex === -1) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const oldTicket = tickets[ticketIndex];
    const updatedTicket = {
      ...oldTicket,
      ...req.body,
      updatedAt: new Date().toISOString(),
      order: parseInt(req.body.order, 10) || oldTicket.order,
      comments: req.body.comments || oldTicket.comments || [],
      history: req.body.history || oldTicket.history || [],
    };

    // Track changes in history
    const history = [...(oldTicket.history || [])];
    if (oldTicket.status !== updatedTicket.status) {
      history.push({
        action: `Status changed from ${oldTicket.status} to ${updatedTicket.status}`,
        timestamp: new Date().toISOString(),
      });
    }
    if (oldTicket.assignee !== updatedTicket.assignee) {
      history.push({
        action: `Assignee changed from ${oldTicket.assignee || 'Unassigned'} to ${updatedTicket.assignee || 'Unassigned'}`,
        timestamp: new Date().toISOString(),
      });
    }
    if (oldTicket.priority !== updatedTicket.priority) {
      history.push({
        action: `Priority changed from ${oldTicket.priority} to ${updatedTicket.priority}`,
        timestamp: new Date().toISOString(),
      });
    }
    updatedTicket.history = history;

    tickets[ticketIndex] = updatedTicket;
    await writeTickets(tickets);
    res.json(updatedTicket);
  } catch (error) {
    console.error('Error in PUT /tickets/:id:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// DELETE a ticket
app.delete('/tickets/:id', async (req, res) => {
  try {
    const tickets = await readTickets();
    const filteredTickets = tickets.filter((ticket) => ticket.id !== req.params.id);
    if (filteredTickets.length === tickets.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await writeTickets(filteredTickets);
    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /tickets/:id:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
