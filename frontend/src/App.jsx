import React, { useState, useEffect } from 'react';
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

// Ticket component (draggable)
const Ticket = ({ ticket, index, columnId, moveTicket, handleAssign }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.TICKET,
    item: { id: ticket.id, index, columnId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className="ticket"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <h3>{ticket.title}</h3>
      <p>{ticket.description}</p>
      <p>Priority: {ticket.priority}</p>
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
        moveTicket(item.id, item.columnId, columnId);
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

  // Fetch tickets from the backend
  useEffect(() => {
    const fetchTickets = async () => {
      const response = await axios.get('http://localhost:5000/tickets');
      const fetchedTickets = response.data;

      // Organize tickets into columns
      const newColumns = {};
      columnsOrder.forEach((column) => {
        newColumns[column] = fetchedTickets.filter(
          (ticket) => ticket.status === column
        );
      });
      setColumns(newColumns);
      setTickets(fetchedTickets);
    };
    fetchTickets();
  }, []);

  // Handle ticket movement between columns
  const moveTicket = async (ticketId, sourceColumnId, destColumnId) => {
    const sourceColumn = [...columns[sourceColumnId]];
    const destColumn = [...columns[destColumnId]];
    const ticketIndex = sourceColumn.findIndex((t) => t.id === ticketId);
    const [movedTicket] = sourceColumn.splice(ticketIndex, 1);

    // Update ticket status and assignee logic
    let updatedTicket = { ...movedTicket, status: destColumnId };
    
    // Unassign when moving to "Ready for Review"
    if (destColumnId === 'Ready for Review') {
      updatedTicket = { ...updatedTicket, assignee: '' };
    }

    // Add ticket to the destination column
    destColumn.push(updatedTicket);

    // Update columns state
    setColumns({
      ...columns,
      [sourceColumnId]: sourceColumn,
      [destColumnId]: destColumn,
    });

    // Update ticket in the backend
    await axios.put(`http://localhost:5000/tickets/${updatedTicket.id}`, updatedTicket);
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

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app">
        <h1>Trello Clone</h1>
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
