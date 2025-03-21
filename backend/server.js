const express = require('express');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const CSV_FILE = './tickets.csv';

// Helper function to read tickets from CSV
const readTickets = async () => {
  const fileContent = await fs.readFile(CSV_FILE);
  return parse(fileContent, { columns: true, skip_empty_lines: true });
};

// Helper function to write tickets to CSV
const writeTickets = async (tickets) => {
  const csv = stringify(tickets, { header: true });
  await fs.writeFile(CSV_FILE, csv);
};

// GET endpoint to fetch all tickets
app.get('/tickets', async (req, res) => {
  try {
    const tickets = await readTickets();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read tickets' });
  }
});

// POST endpoint to create a new ticket
app.post('/tickets', async (req, res) => {
  try {
    const tickets = await readTickets();
    const newTicket = {
      id: (tickets.length + 1).toString(), // Simple ID generation
      title: req.body.title,
      description: req.body.description,
      status: req.body.status || 'ToDo',
      priority: req.body.priority || 'Medium',
      assignee: req.body.assignee || '',
      sprint: req.body.sprint || 'Sprint 1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tickets.push(newTicket);
    await writeTickets(tickets);
    res.status(201).json(newTicket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// PUT endpoint to update a ticket
app.put('/tickets/:id', async (req, res) => {
  try {
    const tickets = await readTickets();
    const ticketIndex = tickets.findIndex((ticket) => ticket.id === req.params.id);
    if (ticketIndex === -1) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updatedTicket = { ...tickets[ticketIndex], ...req.body, updatedAt: new Date().toISOString() };
    tickets[ticketIndex] = updatedTicket;

    await writeTickets(tickets);
    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

app.listen(5000, () => {
  console.log('Backend server running on http://localhost:5000');
});
