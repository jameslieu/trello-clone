import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import './App.css';

// Define the drag-and-drop item type
const ItemTypes = {
  TICKET: 'ticket',
};

// Define the columns order
const columnsOrder = [
  'ToDo',
  'In Progress',
  'Ready for Review',
  'Ready for QA',
  'Ready for Release',
  'Done',
];

// Weighting for prioritization
const priorityWeights = {
  High: 3,
  Medium: 2,
  Low: 1,
};

// Ticket component (draggable)
const Ticket = ({ ticket, index, columnId, moveTicket, handleAssign }) => {
  const ref = useRef(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.TICKET,
    item: { id: ticket.id, index, columnId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [, drop] = useDrop(() => ({
    accept: ItemTypes.TICKET,
    hover: (item, monitor) => {
      if (!ref.current) return;

      const dragIndex = item.index;
      const hoverIndex = index;
      const dragColumnId = item.columnId;
      const hoverColumnId = columnId;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex && dragColumnId === hoverColumnId) return;

      // Only reorder within the same column
      if (dragColumnId === hoverColumnId) {
        moveTicket(item.id, dragColumnId, hoverColumnId, dragIndex, hoverIndex);
        item.index = hoverIndex; // Update the index for the dragged item
      }
    },
  }));

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className="ticket"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <h3>{ticket.title}</h3>
      <p>{ticket.description}</p>
      <p>Priority: {ticket.priority} (Weight: {priorityWeights[ticket.priority]})</p>
      <p>Assignee: {ticket.assignee || 'Unassigned'}</p>
      {columnId === 'Ready for Review' && !ticket.assignee && (
        <select
          onChange={(e) => handleAssign(ticket.id, columnId, e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>
            Assign to...
          </option>
          <option value="Alice">Alice</option>
          <option value="Bob">Bob</option>
          <option value="Charlie">Charlie</option>
          <option value="Diana">Diana</option>
        </select>
      )}
    </div>
  );
};

// Column component (droppable)
const Column = ({ columnId, tickets, moveTicket, handleAssign }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.TICKET,
    drop: (item) => {
      if (item.columnId !== columnId) {
        moveTicket(item.id, item.columnId, columnId, item.index, null);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div ref={drop} className="column" style={{ backgroundColor: isOver ? '#e0e0e0' : '#f4f5f7' }}>
      <h2>{columnId}</h2>
      <div className="ticket-list">
        {tickets.map((ticket, index) => (
          <Ticket
            key={ticket.id}
            ticket={ticket}
            index={index}
            columnId={columnId}
            moveTicket={moveTicket}
            handleAssign={handleAssign}
          />
        ))}
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  const [tickets, setTickets] = useState([]);
  const [columns, setColumns] = useState({});
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    assignee: '',
    sprint: 'Sprint 1',
  });

  // Fetch tickets from the backend
  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    const response = await axios.get('http://localhost:5000/tickets');
    const fetchedTickets = response.data;

    // Organize tickets into columns and sort by priority
    const newColumns = {};
    columnsOrder.forEach((column) => {
      const columnTickets = fetchedTickets.filter(
        (ticket) => ticket.status === column
      );
      // Sort tickets by priority (High to Low)
      newColumns[column] = columnTickets.sort(
        (a, b) => priorityWeights[b.priority] - priorityWeights[a.priority]
      );
    });
    setColumns(newColumns);
    setTickets(fetchedTickets);
  };

  // Handle ticket movement between columns or within the same column
  const moveTicket = async (ticketId, sourceColumnId, destColumnId, dragIndex, hoverIndex) => {
    const sourceColumn = [...columns[sourceColumnId]];
    const ticketIndex = sourceColumn.findIndex((t) => t.id === ticketId);
    const [movedTicket] = sourceColumn.splice(ticketIndex, 1);

    // Update ticket status and assignee logic
    let updatedTicket = { ...movedTicket, status: destColumnId };
    
    // Unassign when moving to "Ready for Review"
    if (destColumnId === 'Ready for Review') {
      updatedTicket = { ...updatedTicket, assignee: '' };
    }

    // If moving within the same column (reordering)
    if (sourceColumnId === destColumnId) {
      const destColumn = [...sourceColumn];
      destColumn.splice(hoverIndex, 0, updatedTicket);

      // Update columns state
      setColumns({
        ...columns,
        [sourceColumnId]: destColumn,
      });

      // Update the backend with the new order (optional, since status didn't change)
      await axios.put(`http://localhost:5000/tickets/${updatedTicket.id}`, updatedTicket);
    } else {
      // Moving to a different column
      const destColumn = [...columns[destColumnId]];
      destColumn.push(updatedTicket);

      // Sort the destination column by priority
      const sortedDestColumn = destColumn.sort(
        (a, b) => priorityWeights[b.priority] - priorityWeights[a.priority]
      );

      // Update columns state
      setColumns({
        ...columns,
        [sourceColumnId]: sourceColumn,
        [destColumnId]: sortedDestColumn,
      });

      // Update ticket in the backend
      await axios.put(`http://localhost:5000/tickets/${updatedTicket.id}`, updatedTicket);
    }
  };

  // Handle assignee change
  const handleAssign = async (ticketId, columnId, newAssignee) => {
    const ticket = columns[columnId].find((t) => t.id === ticketId);
    const updatedTicket = { ...ticket, assignee: newAssignee };

    // Update ticket in the column
    const updatedColumn = columns[columnId].map((t) =>
      t.id === ticketId ? updatedTicket : t
    );

    setColumns({
      ...columns,
      [columnId]: updatedColumn,
    });

    // Update ticket in the backend
    await axios.put(`http://localhost:5000/tickets/${ticketId}`, updatedTicket);
  };

  // Handle new ticket form submission
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/tickets', newTicket);
      const createdTicket = response.data;

      // Refresh tickets
      await fetchTickets();

      // Reset form
      setNewTicket({
        title: '',
        description: '',
        priority: 'Medium',
        assignee: '',
        sprint: 'Sprint 1',
      });
    } catch (error) {
      console.error('Failed to create ticket:', error);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app">
        <h1>Trello Clone</h1>

        {/* Form to create a new ticket */}
        <div className="create-ticket">
          <h2>Create New Ticket</h2>
          <form onSubmit={handleCreateTicket}>
            <div>
              <label>Title:</label>
              <input
                type="text"
                value={newTicket.title}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, title: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label>Description:</label>
              <textarea
                value={newTicket.description}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, description: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label>Priority:</label>
              <select
                value={newTicket.priority}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, priority: e.target.value })
                }
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label>Assignee:</label>
              <select
                value={newTicket.assignee}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, assignee: e.target.value })
                }
              >
                <option value="">Unassigned</option>
                <option value="Alice">Alice</option>
                <option value="Bob">Bob</option>
                <option value="Charlie">Charlie</option>
                <option value="Diana">Diana</option>
              </select>
            </div>
            <div>
              <label>Sprint:</label>
              <input
                type="text"
                value={newTicket.sprint}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, sprint: e.target.value })
                }
              />
            </div>
            <button type="submit">Create Ticket</button>
          </form>
        </div>

        {/* Kanban Board */}
        <div className="board">
          {columnsOrder.map((columnId) => (
            <Column
              key={columnId}
              columnId={columnId}
              tickets={columns[columnId] || []}
              moveTicket={moveTicket}
              handleAssign={handleAssign}
            />
          ))}
        </div>
      </div>
    </DndProvider>
  );
};

export default App;
