const dotenv = require('dotenv');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT;
const cors = require('cors');

dotenv.config();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Get all customers
app.get('/customers', async (req, res) => {
	try {
		// Fetch all customers with their glasses and glasses' installments
		const customer = await prisma.customer.findMany({
			include: {
				glasses: {
					include: {
						installments: true,
					},
				},
			},
		});

		res.json({
			error: false,
			message: 'Customers fetched successfully',
			customer: customer,
		});
	} catch (error) {
		console.error('Error fetching customers:', error);
		res.status(500).json({ error: true, message: 'Internal server error' });
	}
});

// Create new customer with glasses
app.post('/add-customer', async (req, res) => {
	try {
		const {
			name,
			phone,
			address,
			frame,
			lensType,
			left,
			right,
			price,
			deposit,
			orderDate,
			deliveryDate,
			paymentMethod,
		} = req.body;

		//if null send message
		if (
			!name ||
			!phone ||
			!address ||
			!frame ||
			!lensType ||
			!left ||
			!right ||
			!price ||
			!deposit ||
			!orderDate ||
			!deliveryDate ||
			!paymentMethod
		) {
			return res.status(400).json({ error: true, message: 'All fields are required' });
		}

		//if price is less than 0 send message
		if (price <= 0) {
			return res.status(400).json({ error: true, message: 'Price must be greater than 0' });
		}

		//if deposit is less than 0 send message
		if (deposit <= 0) {
			return res.status(400).json({ error: true, message: 'Deposit must be greater than 0' });
		}

		//if deposit is greater than price send message
		if (deposit > price) {
			return res.status(400).json({ error: true, message: 'Deposit must be less than price' });
		}

		//if orderDate is greater than deliveryDate send message
		if (orderDate > deliveryDate) {
			return res
				.status(400)
				.json({ error: true, message: 'Order date must be less than delivery date' });
		}

		//if paymentMethod is not Installments or Full send message
		if (paymentMethod !== 'Installments' && paymentMethod !== 'Cash') {
			return res
				.status(400)
				.json({ error: true, message: 'Payment method must be Installments or Cash' });
		}

		// Check if customer already exists
		const existingCustomer = await prisma.customer.findFirst({
			where: {
				name,
			},
		});

		// Data for the glass entry
		const glassData = {
			frame,
			lensType,
			left,
			right,
			price,
			deposit,
			orderDate,
			deliveryDate,
			paymentMethod,
			paymentStatus: paymentMethod === 'Installments' ? 'Unpaid' : 'Paid',
		};

		// Create the first installment regardless of payment method
		glassData.installments = {
			create: {
				paidDate: new Date(), // Set to the current date as the first payment date
				amount: deposit, // Deposit amount is considered the first payment
				total: deposit,
				remaining: price - deposit,
			},
		};

		if (existingCustomer) {
			// Add new glass to the existing customer
			const newGlass = await prisma.glass.create({
				data: {
					...glassData,
					customerId: existingCustomer.id,
				},
			});

			return res.json({
				error: false,
				message: 'Existing customer, new glass added successfully',
				glass: newGlass,
			});
		}

		// Create new customer with a glass if customer doesn't exist
		const newCustomer = await prisma.customer.create({
			data: {
				name,
				address,
				phone,
				glasses: {
					create: glassData,
				},
			},
		});

		res.json({
			error: false,
			message: 'Customer and glass added successfully',
			customer: newCustomer,
		});
	} catch (error) {
		console.error('Error adding customer or glass:', error);
		res.status(500).json({ error: true, message: 'Internal server error' });
	}
});

// Edit customer and glass details and first installments
app.put('/edit-customer/:id/:glassId', async (req, res) => {
	try {
		const customerId = req.params.id;
		const glassId = req.params.glassId;
		const {
			name,
			phone,
			address,
			frame,
			lensType,
			left,
			right,
			price,
			deposit,
			orderDate,
			deliveryDate,
			paymentMethod,
			paymentStatus,
		} = req.body;
		//if null send message
		if (
			!name ||
			!phone ||
			!address ||
			!frame ||
			!lensType ||
			!left ||
			!right ||
			!price ||
			!deposit ||
			!orderDate ||
			!deliveryDate ||
			!paymentMethod
		) {
			return res.status(400).json({ error: true, message: 'All fields are required' });
		}

		//if price is less than 0 send message
		if (price <= 0) {
			return res.status(400).json({ error: true, message: 'Price must be greater than 0' });
		}

		//if deposit is less than 0 send message
		if (deposit <= 0) {
			return res.status(400).json({ error: true, message: 'Deposit must be greater than 0' });
		}

		//if deposit is greater than price send message
		if (deposit > price) {
			return res.status(400).json({ error: true, message: 'Deposit must be less than price' });
		}

		//if orderDate is greater than deliveryDate send message
		if (orderDate > deliveryDate) {
			return res
				.status(400)
				.json({ error: true, message: 'Order date must be less than delivery date' });
		}

		//if paymentMethod is not Installments or Full send message
		if (paymentMethod !== 'Installments' && paymentMethod !== 'Cash') {
			return res
				.status(400)
				.json({ error: true, message: 'Payment method must be Installments or Cash' });
		}

		// Update customer details based on customerId
		const updatedCustomer = await prisma.customer.update({
			where: {
				id: customerId,
			},
			data: {
				name,
				phone,
				address,
			},
		});

		// Update glass details based on glassId
		const updatedGlass = await prisma.glass.update({
			where: {
				id: glassId,
			},
			data: {
				frame,
				lensType,
				left,
				right,
				price,
				deposit,
				orderDate,
				deliveryDate,
				paymentMethod,
				paymentStatus,
			},
		});

		// Update installments if payment method is Installments
		if (paymentMethod === 'Installments') {
			// Fetch installments related to the glass and sort by paidDate
			const existingInstallments = await prisma.installments.findMany({
				where: {
					glassId: glassId,
				},
				orderBy: {
					paidDate: 'asc', // Sorting by paidDate to get the earliest payment first
				},
			});

			// Update the first installment with the deposit amount (the earliest paidDate)
			if (existingInstallments.length > 0) {
				await prisma.installments.update({
					where: {
						id: existingInstallments[0].id,
					},
					data: {
						paidDate: new Date(), // Set to the current date as the first payment date
						amount: deposit, // Deposit amount is considered the first payment
						total: deposit,
						remaining: price - deposit,
					},
				});
			}
		}

		res.json({
			error: false,
			message: 'Customer and glass details updated successfully',
			customer: updatedCustomer,
			glass: updatedGlass,
		});
	} catch (error) {
		console.error('Error updating customer or glass:', error);
		res.status(500).json({ error: true, message: 'Internal server error' });
	}
});

// add installment
app.post('/add-installment/:glassId', async (req, res) => {
	try {
		const glassId = req.params.glassId;
		const { amount, paidDate } = req.body;

		// if amount is null send message
		if (!amount) {
			return res.status(400).json({ error: true, message: 'Amount is required' });
		}

		//if amount is less than 0 send message
		if (amount <= 0) {
			return res.status(400).json({ error: true, message: 'Amount must be greater than 0' });
		}

		//if paidDate is null send message
		if (!paidDate) {
			return res.status(400).json({ error: true, message: 'Paid date is required' });
		}

		// Fetch the glass and related installments
		const glass = await prisma.glass.findUnique({
			where: {
				id: glassId,
			},
			include: {
				installments: {
					orderBy: {
						paidDate: 'asc', // Ensure installments are ordered by paidDate
					},
				},
			},
		});

		// Calculate the total of previous installments
		const previousTotal = glass.installments.reduce(
			(acc, installment) => acc + installment.amount,
			0
		);

		// Calculate the new total by adding the new amount
		const newTotal = previousTotal + amount;

		// Calculate the remaining amount
		const previousRemaining =
			glass.installments.length > 0
				? glass.installments[glass.installments.length - 1].remaining
				: glass.price;
		const newRemaining = previousRemaining - amount;

		// Create new installment
		const newInstallment = await prisma.installments.create({
			data: {
				paidDate: paidDate,
				amount,
				total: newTotal,
				remaining: newRemaining,
				glassId: glassId,
			},
		});

		// Update payment status if the new remaining amount is 0
		if (newRemaining === 0) {
			await prisma.glass.update({
				where: { id: glassId },
				data: { paymentStatus: 'Paid' },
			});
		}

		res.json({
			error: false,
			message: 'Installment added successfully',
			installment: newInstallment,
		});
	} catch (error) {
		console.error('Error adding installment:', error);
		res.status(500).json({ error: true, message: 'Internal server error' });
	}
});

// edit installment
app.put('/edit-installment/:installmentId', async (req, res) => {
	try {
		const installmentId = req.params.installmentId;
		const { amount, paidDate } = req.body;

		// if amount is null send message
		if (!amount) {
			return res.status(400).json({ error: true, message: 'Amount is required' });
		}

		//if amount is less than 0 send message
		if (amount <= 0) {
			return res.status(400).json({ error: true, message: 'Amount must be greater than 0' });
		}

		//if paidDate is null send message
		if (!paidDate) {
			return res.status(400).json({ error: true, message: 'Paid date is required' });
		}

		// Fetch the installment to be edited and its glass
		const installment = await prisma.installments.findUnique({
			where: {
				id: installmentId,
			},
			include: {
				Glass: true,
			},
		});

		if (!installment) {
			return res.status(404).json({ error: true, message: 'Installment not found' });
		}

		// Fetch all installments related to the same Glass order, ordered by paidDate
		const allInstallments = await prisma.installments.findMany({
			where: {
				glassId: installment.glassId,
			},
			orderBy: {
				paidDate: 'asc',
			},
		});

		// Find the index of the installment to be edited
		const installmentIndex = allInstallments.findIndex((inst) => inst.id === installmentId);

		// Update the amount for the installment to be edited
		allInstallments[installmentIndex].amount = amount;

		// Check if this is the only installment or the earliest installment
		if (allInstallments.length === 1 || installmentIndex === 0) {
			await prisma.glass.update({
				where: { id: installment.glassId },
				data: { deposit: amount },
			});
		}

		// Recalculate the totals and remainings
		let previousTotal = 0;
		let remaining = installment.Glass.price;

		for (let i = 0; i < allInstallments.length; i++) {
			const currentInstallment = allInstallments[i];
			previousTotal += currentInstallment.amount;
			remaining -= currentInstallment.amount;

			currentInstallment.total = previousTotal;
			currentInstallment.remaining = remaining;

			// Save the updated installment
			await prisma.installments.update({
				where: { id: currentInstallment.id },
				data: {
					paidDate: currentInstallment.paidDate,
					amount: currentInstallment.amount,
					total: currentInstallment.total,
					remaining: currentInstallment.remaining,
				},
			});
		}

		// Update payment status if the remaining amount is 0
		if (remaining === 0) {
			await prisma.glass.update({
				where: { id: installment.glassId },
				data: { paymentStatus: 'Paid' },
			});
		}

		res.json({
			error: false,
			message: 'Installment updated successfully',
		});
	} catch (error) {
		console.error('Error updating installment:', error);
		res.status(500).json({ error: true, message: 'Internal server error' });
	}
});

// hapus angsuran dengan paidDate terbaru
app.delete('/delete-latest-installment/:glassId', async (req, res) => {
	try {
		const glassId = req.params.glassId;

		// Fetch the latest installment based on paidDate
		const latestInstallment = await prisma.installments.findFirst({
			where: {
				glassId: glassId,
			},
			orderBy: {
				paidDate: 'desc', // Order by paidDate in descending order to get the latest
			},
		});

		// Check if there's an installment to delete
		if (!latestInstallment) {
			return res.status(404).json({
				error: true,
				message: 'No installment found to delete.',
			});
		}

		// Delete the latest installment
		await prisma.installments.delete({
			where: {
				id: latestInstallment.id,
			},
		});

		res.json({
			error: false,
			message: 'Latest installment deleted successfully',
			installment: latestInstallment,
		});
	} catch (error) {
		console.error('Error deleting latest installment:', error);
		res.status(500).json({ error: true, message: 'Internal server error' });
	}
});

// hapus semua data semua customer dan glass dan installment
app.delete('/delete-all', async (req, res) => {
	try {
		// Delete all installments
		await prisma.installments.deleteMany();

		// Delete all glasses
		await prisma.glass.deleteMany();

		// Delete all customers
		await prisma.customer.deleteMany();

		res.json({
			error: false,
			message: 'All data deleted successfully',
		});
	} catch (error) {
		console.error('Error deleting all data:', error);
		res.status(500).json({ error: true, message: 'Internal server error' });
	}
});

// Landing page
app.get('/', (req, res) => {
	res.send('Hello World!');
});

app.listen(PORT, () => {
	console.log('Anugrah Lens API running in port: ' + PORT);
});
