const { sequelize, ChatSession, ChatMessage } = require('../models');
const { QueryTypes } = require('sequelize');

const formatCurrencyMsg = (num) => {
  const absNum = Math.abs(num);
  if (absNum >= 1.0e9) return `₹${(num / 1.0e9).toFixed(2)}B`;
  if (absNum >= 1.0e7) return `₹${(num / 1.0e7).toFixed(2)}Cr`;
  if (absNum >= 1.0e5) return `₹${(num / 1.0e5).toFixed(2)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const dictionary = {
  cagr: "CAGR means Compound Annual Growth Rate. It shows the average yearly growth rate over a period. In PSIDSS, it helps understand how port revenue has grown across financial years after smoothing year-to-year fluctuations.",
  hhi: "HHI measures concentration. In this project, it can show whether revenue depends too much on a few customers, berths, or commodity groups. Higher HHI means higher dependency risk.",
  'tariff simulation': "Tariff Simulation is a what-if calculation. It estimates how revenue may change if tariffs increase or decrease. In this project, it applies the selected percentage change to historical billing revenue.",
  yoy: "YoY stands for Year-over-Year growth. It compares the revenue of one financial year directly with the previous financial year to show short-term growth dynamics.",
  revenue: "Revenue represents the total billing amount generated from port services and cargo-related activities. It indicates the gross financial intake before subtracting operational costs.",
  'invoice amount': "Invoice Amount is the specific billing value recorded for an individual port transaction, serving as the base data for all revenue aggregations.",
  vcn: "VCN stands for Vessel Call Number. It is a unique identifier assigned to each vessel visit or call at the port, allowing precise tracking of ship operations and billing.",
  grt: "GRT stands for Gross Registered Tonnage. It measures a vessel's total internal volume, which is often used as the basis for calculating port dues and pilotage charges.",
  berth: "A berth is a designated location in the port where vessels dock to load, unload, or receive services. Berth performance is key to terminal efficiency.",
  commodity: "A commodity refers to the specific cargo type handled, such as cement, petroleum, or fertilizer raw materials. Tracking commodities helps optimize handling infrastructure.",
  'commodity group': "A commodity group is a broader category of related cargo types (e.g., Petroleum, Containers, or Dry Bulk), simplifying high-level trade analysis.",
  'charge name': "Charge Name refers to the specific billing head or service type invoiced, such as Pilotage, Port Dues, Berth Hire, or Wharfage.",
  'party name': "Party Name represents the customer, shipping agent, or billing partner responsible for the port transactions, used to analyze client revenue concentration.",
  'port dues': "Port Dues are fees charged on incoming vessels for entering port limits and utilizing basic port navigation and security infrastructure.",
  pilotage: "Pilotage charges cover services where a licensed port pilot guides a vessel safely through the harbor channel to and from the berths.",
  wharfage: "Wharfage is the fee charged for cargo passing over the port's wharves or docks, calculated based on weight, volume, or package type.",
  anchorage: "Anchorage fees are charged to vessels anchored in designated harbor waters outside active berths while waiting for clearance or cargo availability."
};

function checkDictionary(message) {
  const cleanMsg = message.toLowerCase().trim().replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  
  const prefixes = ['what is ', 'what does ', 'define ', 'explain ', 'meaning of ', 'what is a ', 'what is an '];
  let term = cleanMsg;
  for (const prefix of prefixes) {
    if (cleanMsg.startsWith(prefix)) {
      term = cleanMsg.substring(prefix.length).trim();
      break;
    }
  }

  if (term.endsWith(" mean")) {
    term = term.substring(0, term.length - 5).trim();
  }
  if (term.endsWith(" stands for")) {
    term = term.substring(0, term.length - 11).trim();
  }

  if (dictionary[term]) {
    return {
      answer: dictionary[term],
      type: 'dictionary',
      source: 'dictionary'
    };
  }

  return null;
}

function generateAutoTitle(firstMsg) {
  const clean = firstMsg.toLowerCase();
  if (clean.includes('cagr')) return 'CAGR Explanation';
  if (clean.includes('berth')) return 'Top Berth Revenue';
  if (clean.includes('revenue') || clean.includes('income') || clean.includes('earnings')) return 'Total Port Revenue';
  if (clean.includes('customer') || clean.includes('party')) return 'Top Customer Details';
  if (clean.includes('commodity') || clean.includes('cargo')) return 'Top Commodity Cargo';
  if (clean.includes('simulation') || clean.includes('tariff')) return 'Tariff Simulation Help';
  if (clean.includes('hhi')) return 'HHI Analysis';
  if (clean.includes('vcn')) return 'VCN Details';
  if (clean.includes('grt')) return 'GRT Volume';

  const words = firstMsg.trim().split(/\s+/).slice(0, 4);
  return words.join(' ') || 'New Chat';
}

const chatbotController = {
  // Fetch sessions
  getSessions: async (req, res) => {
    try {
      const sessions = await ChatSession.findAll({
        where: { user_id: req.user.id },
        include: [{
          model: ChatMessage,
          limit: 1,
          order: [['createdAt', 'DESC']]
        }],
        order: [['updatedAt', 'DESC']]
      });

      const result = sessions.map(s => {
        const lastMsg = s.ChatMessages && s.ChatMessages.length > 0 ? s.ChatMessages[0].message : null;
        return {
          id: s.id,
          title: s.title,
          lastMessage: lastMsg,
          updatedAt: s.updatedAt
        };
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(550).json({ error: 'Failed to fetch sessions' });
    }
  },

  // Create session
  createSession: async (req, res) => {
    try {
      const title = req.body.title || 'New Chat';
      const session = await ChatSession.create({
        user_id: req.user.id,
        title
      });
      res.json({ id: session.id, title: session.title });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create session' });
    }
  },

  // Fetch session messages
  getSessionMessages: async (req, res) => {
    try {
      const session = await ChatSession.findOne({
        where: { id: req.params.id, user_id: req.user.id }
      });
      if (!session) {
        return res.status(404).json({ error: 'Session not found or unauthorized' });
      }

      const messages = await ChatMessage.findAll({
        where: { session_id: session.id },
        order: [['createdAt', 'ASC']]
      });

      res.json(messages.map(m => ({
        role: m.role,
        message: m.message,
        source: m.source,
        type: m.type,
        createdAt: m.createdAt
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  },

  // Delete single session
  deleteSession: async (req, res) => {
    try {
      const session = await ChatSession.findOne({
        where: { id: req.params.id, user_id: req.user.id }
      });
      if (!session) {
        return res.status(404).json({ error: 'Session not found or unauthorized' });
      }

      await session.destroy();
      res.json({ success: true, message: 'Session deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  },

  // Clear all sessions
  clearAllSessions: async (req, res) => {
    try {
      await ChatSession.destroy({
        where: { user_id: req.user.id }
      });
      res.json({ success: true, message: 'All chat history cleared' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to clear chat sessions' });
    }
  },

  // Updated Ask handler
  ask: async (req, res) => {
    try {
      const { message, sessionId, year, pageContext } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const cleanMsg = message.toLowerCase().trim();
      const yearScope = year || 'All';

      // 1. Get or Create Session
      let session;
      if (sessionId) {
        session = await ChatSession.findOne({
          where: { id: sessionId, user_id: req.user.id }
        });
      }

      if (!session) {
        session = await ChatSession.create({
          user_id: req.user.id,
          title: 'New Chat'
        });
      }

      // 2. Handle Clear Chat Commands
      const clearCommands = ['clear chat', 'delete all above chats', 'delete all the above chats', 'reset chat', 'start new chat'];
      if (clearCommands.includes(cleanMsg)) {
        let activeSession = session;
        if (cleanMsg === 'start new chat') {
          activeSession = await ChatSession.create({
            user_id: req.user.id,
            title: 'New Chat'
          });
        } else {
          // Clear current session messages
          await ChatMessage.destroy({ where: { session_id: session.id } });
        }

        const responseMsg = {
          answer: "Chat cleared. I am your Port DSS Assistant. Ask me about revenue, berths, customers, commodities, tariff simulation, or port terms.",
          type: "chat_control",
          action: "clear_current_chat",
          source: "system",
          sessionId: activeSession.id
        };

        // Save greeting message to active session
        await ChatMessage.create({
          session_id: activeSession.id,
          role: 'assistant',
          message: responseMsg.answer,
          source: 'system',
          type: 'chat_control'
        });

        activeSession.changed('updatedAt', true);
        await activeSession.save();

        return res.json(responseMsg);
      }

      // 3. Save User message to Database
      await ChatMessage.create({
        session_id: session.id,
        role: 'user',
        message: message
      });

      // 4. Build SQL filters for year & role scoping
      const conditions = [];
      const replacements = {};

      if (yearScope && yearScope !== 'All' && yearScope !== 'All Fiscal Years' && yearScope !== 'all') {
        if (yearScope === 'Recent4') {
          conditions.push('source_year BETWEEN 2021 AND 2024');
        } else {
          const numYear = parseInt(yearScope, 10);
          if (!isNaN(numYear)) {
            conditions.push('source_year = :yearScope');
            replacements.yearScope = numYear;
          }
        }
      }

      if (req.user) {
        if (req.user.role === 'Party' && req.user.party_name) {
          conditions.push('party_name = :userPartyName');
          replacements.userPartyName = req.user.party_name;
        } else if (req.user.role === 'VCN' && req.user.vcn) {
          conditions.push('vcn = :userVcn');
          replacements.userVcn = req.user.vcn;
        }
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      // 5. Process Intent
      let answer = "";
      let type = "unsupported";
      let source = "system";

      // A. Check built-in Dictionary
      const dictMatch = checkDictionary(message);
      if (dictMatch) {
        answer = dictMatch.answer;
        type = dictMatch.type;
        source = dictMatch.source;
      } else {
        // B. Check Unsupported operational topics
        const isUnsupported = cleanMsg.includes('crane') || cleanMsg.includes('occupancy') || 
                              cleanMsg.includes('weather') || cleanMsg.includes('maintenance') || 
                              cleanMsg.includes('congestion') || cleanMsg.includes('operational delay') || 
                              cleanMsg.includes('rerouting');
                              
        if (isUnsupported) {
          answer = "This cannot be answered from the available financial dataset. The uploaded Cochin Port records contain billing revenue, vessel call indicators, berths, customers, and cargo categories, but do not contain crane operation, occupancy, weather, or maintenance logistics.";
          type = "unsupported";
          source = "system";
        } else {
          // C. Data Intent Detections
          
          // I. Top Customer
          const isTopCust = cleanMsg.includes('top customer') || cleanMsg.includes('highest revenue customer') || cleanMsg.includes('party generated highest') || cleanMsg.includes('who is the top customer') || cleanMsg.includes('top company');
          // II. Top Berth
          const isTopBerth = cleanMsg.includes('top berth') || cleanMsg.includes('highest revenue berth') || cleanMsg.includes('berth has highest') || cleanMsg.includes('berth by revenue') || cleanMsg.includes('which berth');
          // III. Yearly Revenue Trend
          const isTrend = cleanMsg.includes('revenue trend') || cleanMsg.includes('revenue increasing') || cleanMsg.includes('growth over years') || cleanMsg.includes('revenue growth trend') || cleanMsg.includes('show trend') || cleanMsg.includes('is revenue growing') || cleanMsg.includes('is revenue increasing') || cleanMsg.includes('is port revenue decreasing');
          // IV. Commodity / Cargo Category
          const isCommodity = cleanMsg.includes('top commodity') || cleanMsg.includes('top cargo') || cleanMsg.includes('commodity group earns') || cleanMsg.includes('commodity earns most') || cleanMsg.includes('what cargo group') || cleanMsg.includes('commodity group');
          // V. Customer Concentration
          const isConcentration = cleanMsg.includes('customer concentration') || cleanMsg.includes('dependent on few customer') || cleanMsg.includes('revenue dependent on few') || cleanMsg.includes('explain customer concentration');
          // VI. Tariff Simulation
          const isSim = cleanMsg.includes('tariff simulation') || cleanMsg.includes('tariff increases by') || cleanMsg.includes('simulation work') || cleanMsg.includes('simulate tariff');
          // VII. Revenue general question
          const isRevenue = cleanMsg.includes('revenue') || cleanMsg.includes('billing receipts') || cleanMsg.includes('invoice amount') || cleanMsg.includes('earnings') || cleanMsg.includes('income');

          if (isTopCust) {
            const result = await sequelize.query(`
              SELECT party_name, SUM(invoice_amount) as revenue
              FROM PortRecords
              ${whereClause}
              GROUP BY party_name
              ORDER BY revenue DESC
              LIMIT 1
            `, { type: QueryTypes.SELECT, replacements });

            const totalResult = await sequelize.query(`
              SELECT COALESCE(SUM(invoice_amount), 0) as total
              FROM PortRecords
              ${whereClause}
            `, { type: QueryTypes.SELECT, replacements });

            if (result.length > 0) {
              const custName = result[0].party_name;
              const custRev = parseFloat(result[0].revenue) || 0;
              const totalRev = parseFloat(totalResult[0].total) || 1.0;
              const share = (custRev / totalRev) * 100;

              answer = `The top customer is ${custName}, contributing ${formatCurrencyMsg(custRev)}. This represents about ${share.toFixed(2)}% of total revenue for the selected period, so it is one of the port’s most important billing partners. This is based on Cochin Port uploaded financial records.`;
              type = "top_customer";
              source = "database";
            } else {
              answer = "No customer revenue records found for the selected scope.";
              type = "top_customer";
              source = "database";
            }
          } else if (isTopBerth) {
            const result = await sequelize.query(`
              SELECT berth, SUM(invoice_amount) as revenue
              FROM PortRecords
              ${whereClause}
              GROUP BY berth
              ORDER BY revenue DESC
              LIMIT 1
            `, { type: QueryTypes.SELECT, replacements });

            if (result.length > 0) {
              const berth = result[0].berth;
              const rev = parseFloat(result[0].revenue) || 0;
              answer = `The highest revenue-generating berth is Berth ${berth} with ${formatCurrencyMsg(rev)} in revenue for the selected period. This means Berth ${berth} is a major revenue contributor and tariff or operational decisions related to this berth can have a strong financial impact. This is based on Cochin Port uploaded financial records.`;
              type = "top_berth";
              source = "database";
            } else {
              answer = "No berth revenue records found for the selected scope.";
              type = "top_berth";
              source = "database";
            }
          } else if (isTrend) {
            const result = await sequelize.query(`
              SELECT source_year as year, SUM(invoice_amount) as revenue
              FROM PortRecords
              ${whereClause}
              GROUP BY source_year
              ORDER BY source_year ASC
            `, { type: QueryTypes.SELECT, replacements });

            if (result.length >= 2) {
              const year1 = result[0].year;
              const rev1 = parseFloat(result[0].revenue) || 0;
              const yearN = result[result.length - 1].year;
              const revN = parseFloat(result[result.length - 1].revenue) || 0;
              const growth = ((revN - rev1) / rev1) * 100;

              let hasDecline = false;
              for (let i = 1; i < result.length; i++) {
                if (parseFloat(result[i].revenue) < parseFloat(result[i - 1].revenue)) {
                  hasDecline = true;
                }
              }

              const directAnswer = revN > rev1 ? "Yes, revenue is increasing overall." : "No, revenue is decreasing overall.";
              const evidence = `Revenue grew from ${formatCurrencyMsg(rev1)} in FY${year1}–${(year1 % 100 + 1)} to ${formatCurrencyMsg(revN)} in FY${yearN}–${(yearN % 100 + 1)}, which is about +${growth.toFixed(0)}% overall growth.`;
              const interpretation = hasDecline 
                ? "There was an early drop in FY2017–18, but from FY2018–19 onward the trend is mostly upward. This indicates positive long-term revenue growth"
                : "The revenue has shown consistent year-over-year gains across the years, indicating strong financial momentum";

              answer = `${directAnswer} ${evidence} ${interpretation} based on uploaded financial records.`;
              type = "yearly_trend";
              source = "database";
            } else if (result.length === 1) {
              answer = `The revenue for the selected scope is ${formatCurrencyMsg(result[0].revenue)}. A multi-year comparison is required to show a trend.`;
              type = "yearly_trend";
              source = "database";
            } else {
              answer = "No revenue records were found for the selected scope.";
              type = "yearly_trend";
              source = "database";
            }
          } else if (isCommodity) {
            const result = await sequelize.query(`
              SELECT 
                COALESCE(NULLIF(commodity_group, ''), commodity) as name, 
                SUM(invoice_amount) as revenue
              FROM PortRecords
              ${whereClause}
              GROUP BY name
              ORDER BY revenue DESC
              LIMIT 1
            `, { type: QueryTypes.SELECT, replacements });

            if (result.length > 0) {
              const name = result[0].name;
              const rev = parseFloat(result[0].revenue) || 0;
              answer = `The top cargo category is '${name}', contributing a total revenue of ${formatCurrencyMsg(rev)} for the selected period. This indicates that '${name}' cargo handling constitutes a major volume and billing line for the port. This is based on Cochin Port uploaded financial records.`;
              type = "top_commodity";
              source = "database";
            } else {
              answer = "No commodity cargo records found for the selected scope.";
              type = "top_commodity";
              source = "database";
            }
          } else if (isConcentration) {
            const custResult = await sequelize.query(`
              SELECT party_name, SUM(invoice_amount) as revenue
              FROM PortRecords
              ${whereClause}
              GROUP BY party_name
              ORDER BY revenue DESC
            `, { type: QueryTypes.SELECT, replacements });

            if (custResult.length > 0) {
              const totalRev = custResult.reduce((sum, c) => sum + parseFloat(c.revenue), 0) || 1.0;
              const top1 = parseFloat(custResult[0].revenue);
              const top5 = custResult.slice(0, 5).reduce((sum, c) => sum + parseFloat(c.revenue), 0);
              const top1Share = (top1 / totalRev) * 100;
              const top5Share = (top5 / totalRev) * 100;

              let severity = 'low customer dependency risk';
              if (top1Share > 25 || top5Share > 60) {
                severity = 'high customer concentration risk, indicating strong dependency on a few key customers';
              } else if (top5Share > 40) {
                severity = 'moderate customer concentration risk';
              }

              answer = `Based on the uploaded Cochin Port billing records, the top customer represents ${top1Share.toFixed(2)}% of total revenue, and the top 5 customers represent ${top5Share.toFixed(2)}%. This indicates a ${severity}.`;
              type = "dictionary";
              source = "database";
            } else {
              answer = "No customer billing records available to calculate concentration.";
              type = "dictionary";
              source = "database";
            }
          } else if (isSim) {
            answer = "Tariff Simulation is a what-if calculation. It estimates how revenue may change if tariffs increase or decrease. In this project, it applies the selected percentage change to historical billing revenue.";
            type = "tariff_simulation";
            source = "system";
          } else if (isRevenue) {
            const result = await sequelize.query(`
              SELECT COALESCE(SUM(invoice_amount), 0) as totalRevenue
              FROM PortRecords
              ${whereClause}
            `, { type: QueryTypes.SELECT, replacements });

            const rev = parseFloat(result[0].totalRevenue) || 0;
            const formattedRev = rev > 0 ? formatCurrencyMsg(rev) : "No revenue records were found for the selected scope.";

            answer = `Total Port Revenue is the total billing amount generated from all uploaded port financial records. It is calculated as SUM(invoice_amount) from the PortRecords table. For the selected period (${yearScope === 'Recent4' ? 'FY 2021–22 to FY 2024–25' : yearScope === 'All' ? 'All Fiscal Years' : `FY ${yearScope}–${parseInt(yearScope)%100+1}`}), total revenue is ${formattedRev}. This is a financial billing metric, not cargo volume or profit.`;
            type = "revenue_explanation";
            source = "database";
          } else {
            answer = "I cannot find an answer to this question in the port dictionary or database. Please ask about revenue, berths, customers, commodities, or tariff terms.";
            type = "unsupported";
            source = "system";
          }
        }
      }

      // 6. Save Assistant response to Database
      await ChatMessage.create({
        session_id: session.id,
        role: 'assistant',
        message: answer,
        source: source,
        type: type
      });

      // 7. Update Session Title if it is "New Chat"
      if (session.title === 'New Chat') {
        const autoTitle = generateAutoTitle(message);
        session.title = autoTitle;
      }

      session.changed('updatedAt', true);
      await session.save();

      // 8. Return response
      res.json({
        sessionId: session.id,
        answer,
        type,
        source
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to process chatbot request' });
    }
  }
};

module.exports = chatbotController;
