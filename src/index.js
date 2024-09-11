const dotenv = require('dotenv');
const express = require('express');
const { PrismaClient, PaymentMethod } = require('@prisma/client');
const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT;
const cors = require('cors');

dotenv.config();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
	cors({
		origin: '*', //
		credentials: false,
	})
);

// Get all customers
app.get('/customers', async (req, res) => {
	try {
		// Fetch all customers with their glasses and glasses' installments AND sort by PAIDDATE
		const customer = await prisma.customer.findMany({
			include: {
				glasses: {
					include: {
						installments: {
							orderBy: {
								paidDate: 'asc',
							},
						},
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

// get customer by id
app.get('/customer/:id', async (req, res) => {
	try {
		const customerId = req.params.id;

		// Fetch customer by id with their glasses and glasses' installments
		const customer = await prisma.customer.findUnique({
			where: {
				id: customerId,
			},
			include: {
				glasses: {
					include: {
						installments: {
							orderBy: {
								paidDate: 'asc',
							},
						},
					},
				},
			},
		});

		if (!customer) {
			return res.status(404).json({ error: true, message: 'Customer not found' });
		}

		res.json({
			error: false,
			message: 'Customer fetched successfully',
			customer: customer,
		});
	} catch (error) {
		console.error('Error fetching customer:', error);
		res.status(500).json({ error: true, message: 'Internal server error' });
	}
});

app.get('/customer/:id/glasses', async (req, res) => {
	try {
		const customerId = req.params.id;

		// Fetch all glasses related to the customer with their installments
		const glasses = await prisma.glass.findMany({
			where: {
				customerId: customerId,
			},
			include: {
				installments: {
					orderBy: {
						paidDate: 'asc',
					},
				},
			},
		});

		res.json({
			error: false,
			message: 'Glasses fetched successfully',
			glasses: glasses,
		});
	} catch (error) {
		console.error('Error fetching glasses:', error);
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

		// Buat array untuk menyimpan pesan error
		const missingFields = [];

		// Cek setiap field
		if (!name) missingFields.push('Name');
		if (!address) missingFields.push('Address');
		if (!frame) missingFields.push('Frame');
		if (!lensType) missingFields.push('Lens Type');
		if (!left) missingFields.push('Left Lens');
		if (!right) missingFields.push('Right Lens');
		if (!price) missingFields.push('Price');
		if (!orderDate) missingFields.push('Order Date');
		if (!deliveryDate) missingFields.push('Delivery Date');
		if (!paymentMethod) missingFields.push('Payment Method');

		// Jika ada field yang kosong, kirimkan pesan error
		if (missingFields.length > 0) {
			return res.status(400).json({
				error: true,
				message: `The following fields are missing: ${missingFields.join(', ')}`,
			});
		}

		//if price is less than 0 send message
		if (price <= 0) {
			return res.status(400).json({ error: true, message: 'Price must be greater than 0' });
		}

		//if deposit is less than 0 send message
		if (deposit < 0) {
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
			paymentStatus: deposit === price ? 'Paid' : 'Unpaid',
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

		// Create new customer with a glass if customer doesn't exist and if deposit is same as price set payment status to Paid
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

		// after creating customer, if deposit is same as price set payment status to Paid
		if (price === deposit) {
			await prisma.glass.update({
				where: {
					id: newCustomer.glasses[0].id,
				},
				data: {
					paymentStatus: 'Paid',
				},
			});
		}

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

		// Validate required fields
		if (
			!name ||
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

		// Validate price and deposit
		if (price <= 0) {
			return res.status(400).json({ error: true, message: 'Price must be greater than 0' });
		}
		if (deposit < 0) {
			return res.status(400).json({ error: true, message: 'Deposit must be greater than 0' });
		}
		if (deposit > price) {
			return res.status(400).json({ error: true, message: 'Deposit must be less than price' });
		}

		// Validate dates
		if (orderDate > deliveryDate) {
			return res
				.status(400)
				.json({ error: true, message: 'Order date must be less than delivery date' });
		}

		// Validate payment method
		if (paymentMethod !== 'Installments' && paymentMethod !== 'Cash') {
			return res
				.status(400)
				.json({ error: true, message: 'Payment method must be Installments or Cash' });
		}

		// Update customer details
		const updatedCustomer = await prisma.customer.update({
			where: { id: customerId },
			data: {
				name,
				phone,
				address,
			},
		});

		// Update glass details
		const updatedGlass = await prisma.glass.update({
			where: { id: glassId },
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

		// Handle installment updates if payment method is Installments
		if (paymentMethod === 'Installments' || PaymentMethod === 'Cash') {
			// Fetch all installments related to the glass order, ordered by paidDate
			const allInstallments = await prisma.installments.findMany({
				where: { glassId: glassId },
				orderBy: { paidDate: 'asc' },
			});

			let previousTotal = 0;
			let remaining = price;

			// Iterate through installments to update amounts and totals
			for (let i = 0; i < allInstallments.length; i++) {
				const currentInstallment = allInstallments[i];

				if (i === 0) {
					// Update the first installment with the deposit amount
					currentInstallment.amount = deposit;
				}

				previousTotal += currentInstallment.amount;
				remaining -= currentInstallment.amount;

				currentInstallment.total = previousTotal;
				currentInstallment.remaining = remaining;

				// Save the updated installment
				await prisma.installments.update({
					where: { id: currentInstallment.id },
					data: {
						amount: currentInstallment.amount,
						total: currentInstallment.total,
						remaining: currentInstallment.remaining,
					},
				});
			}

			// Update payment status if fully paid
			if (remaining === 0) {
				await prisma.glass.update({
					where: { id: glassId },
					data: { paymentStatus: 'Paid' },
				});
			} else
				await prisma.glass.update({
					where: { id: glassId },
					data: { paymentStatus: 'Unpaid' },
				});
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

// Delete customer all data by id
app.delete('/delete-customer/:id', async (req, res) => {
	try {
		const customerId = req.params.id;

		// Fetch the customer and related glasses
		const customer = await prisma.customer.findUnique({
			where: { id: customerId },
			include: { glasses: true },
		});

		if (!customer) {
			return res.status(404).json({ error: true, message: 'Customer not found' });
		}

		// Delete all installments related to the glasses
		await prisma.installments.deleteMany({
			where: {
				glassId: {
					in: customer.glasses.map((glass) => glass.id),
				},
			},
		});

		// Delete all glasses related to the customer
		await prisma.glass.deleteMany({
			where: {
				customerId: customerId,
			},
		});

		// Delete the customer
		await prisma.customer.delete({
			where: { id: customerId },
		});

		res.json({
			error: false,
			message: 'Customer and related data deleted successfully',
		});
	} catch (error) {
		console.error('Error deleting customer:', error);
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

		// if amount is less than 0 send message
		if (amount <= 0) {
			return res.status(400).json({ error: true, message: 'Amount must be greater than 0' });
		}

		// if paidDate is null send message
		if (!paidDate) {
			return res.status(400).json({ error: true, message: 'Paid date is required' });
		}

		// Fetch the glass and related installments
		const glass = await prisma.glass.findUnique({
			where: { id: glassId },
			include: {
				installments: {
					orderBy: { paidDate: 'asc' }, // Ensure installments are ordered by paidDate
				},
			},
		});

		// Check if there are existing installments
		if (glass.installments.length > 0) {
			// Get the first installment's paidDate
			const firstInstallmentDate = new Date(glass.installments[0].paidDate);

			// Check if the new paidDate is before the first installment's paidDate
			if (new Date(paidDate) < firstInstallmentDate) {
				return res.status(400).json({
					error: true,
					message: 'Installment cannot be added before the first installment date',
				});
			}
		}

		// Calculate the remaining amount from the last installment
		const previousRemaining =
			glass.installments.length > 0
				? glass.installments[glass.installments.length - 1].remaining
				: glass.price;

		// Check if the amount is greater than the previous remaining amount and maximum amount
		if (amount > previousRemaining) {
			return res.status(400).json({
				error: true,
				message: `Amount exceeds remaining balance. Maximum amount is ${previousRemaining}`,
			});
		}

		// Insert the new installment and update remaining amounts for subsequent installments
		let newTotal = 0;
		let newRemaining = glass.price;

		// Array to store installment updates
		const updatedInstallments = [];

		// Insert new installment at the correct position based on paidDate
		const newInstallmentIndex = glass.installments.findIndex(
			(inst) => new Date(inst.paidDate) > new Date(paidDate)
		);

		// Recalculate the totals and remaining for all installments including the new one
		for (let i = 0; i <= glass.installments.length; i++) {
			if (
				i === newInstallmentIndex ||
				(i === glass.installments.length && newInstallmentIndex === -1)
			) {
				// Insert the new installment
				newTotal += amount;
				newRemaining -= amount;

				updatedInstallments.push({
					paidDate,
					amount,
					total: newTotal,
					remaining: newRemaining,
					glassId,
				});
			}

			if (i < glass.installments.length) {
				// Update existing installment
				const installment = glass.installments[i];
				newTotal += installment.amount;
				newRemaining -= installment.amount;

				updatedInstallments.push({
					...installment,
					total: newTotal,
					remaining: newRemaining,
				});
			}
		}

		// Save all updated installments including the new one
		for (const installment of updatedInstallments) {
			if (installment.id) {
				await prisma.installments.update({
					where: { id: installment.id },
					data: {
						total: installment.total,
						remaining: installment.remaining,
					},
				});
			} else {
				await prisma.installments.create({
					data: installment,
				});
			}
		}

		// Update payment status if the new remaining amount is 0
		if (newRemaining === 0) {
			await prisma.glass.update({
				where: { id: glassId },
				data: { paymentStatus: 'Paid' },
			});
		} else {
			await prisma.glass.update({
				where: { id: glassId },
				data: { paymentStatus: 'Unpaid' },
			});
		}

		res.json({
			error: false,
			message: 'Installment added successfully',
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

		// if amount is less than 0 send message
		if (amount <= 0) {
			return res.status(400).json({ error: true, message: 'Amount must be greater than 0' });
		}

		// if paidDate is null send message
		if (!paidDate) {
			return res.status(400).json({ error: true, message: 'Paid date is required' });
		}

		// Fetch the installment to be edited and its glass
		const installment = await prisma.installments.findUnique({
			where: { id: installmentId },
			include: { Glass: true },
		});

		if (!installment) {
			return res.status(404).json({ error: true, message: 'Installment not found' });
		}

		// Fetch all installments related to the same Glass order, ordered by paidDate
		const allInstallments = await prisma.installments.findMany({
			where: { glassId: installment.glassId },
			orderBy: { paidDate: 'asc' },
		});

		// Ensure the new paidDate is not before the first installment's paidDate
		if (new Date(paidDate) < new Date(allInstallments[0].paidDate)) {
			return res.status(400).json({
				error: true,
				message: 'Paid date cannot be earlier than the first installment date',
			});
		}

		// Calculate the total of all installments amount excluding the current one
		const totalAmountExcludingCurrent = allInstallments
			.filter((inst) => inst.id !== installmentId)
			.reduce((acc, inst) => acc + inst.amount, 0);

		// Calculate the remaining amount
		const remainingAmount = installment.Glass.price - totalAmountExcludingCurrent;

		// Check if the amount is greater than the remaining amount
		if (amount > remainingAmount) {
			return res.status(400).json({
				error: true,
				message: `Amount exceeds remaining balance. Maximum amount is ${remainingAmount}`,
			});
		}

		// Find the index of the installment to be edited
		const installmentIndex = allInstallments.findIndex((inst) => inst.id === installmentId);

		// Update the amount and paidDate for the installment to be edited
		allInstallments[installmentIndex].amount = amount;
		allInstallments[installmentIndex].paidDate = paidDate;

		// Recalculate the totals and remaining amounts
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
					amount: currentInstallment.amount,
					total: currentInstallment.total,
					remaining: currentInstallment.remaining,
					paidDate: currentInstallment.paidDate,
				},
			});
		}

		// Update deposit if this is the only installment or the earliest installment
		if (installmentIndex === 0) {
			await prisma.glass.update({
				where: { id: installment.glassId },
				data: { deposit: amount },
			});
		}

		// Update payment status if the remaining amount is 0
		if (remaining === 0) {
			await prisma.glass.update({
				where: { id: installment.glassId },
				data: { paymentStatus: 'Paid' },
			});
		} else
			await prisma.glass.update({
				where: { id: installment.glassId },
				data: { paymentStatus: 'Unpaid' },
			});

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
