const { Patient, Caretaker, Session, NDC, SessionIntake, Medication, sequelize, Cabinet, CabinetBox, Schedule } = require('./database');
const constants = require("./constants");
const axios = require("axios");
const utils = require("./utils");
const Handlebars = require('handlebars');

Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});
// Portal Endpoints

/**
 * Renders the profile page with patient and caretaker data.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
const profile = async (req, res) => {
    if (req.session.user) {
        try {
            return res.render('profile', {
                patients: await getAllPatients(), careTaker: await getCaretaker(req.session.user),
            });
        } catch (error) {
            console.error(error);
        }
    } else {
        res.redirect('/login');
    }
}
// API Endpoints

/**
 * Searches for medications based on the provided search query.
 *
 * @async
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise} A promise representing the search results.
 * @throws {Error} If an error occurs during the search process.
 * @description This function takes a search query as input, constructs a query string,
 * sends a request to the FDA API, and returns the filtered medication data.
 */
// const search_medications = async (req, res) => {
//     const searchQuery = req.params.searchQuery;
//     const query = `search=(openfda.brand_name:"${searchQuery}" OR openfda.generic_name:"${searchQuery}"OR openfda.product_ndc:"${searchQuery}")`;
//     const url = `${constants.FDABaseUrl}?${query}&limit=10`;

//     try {
//         const response = await axios.get(url);
//         if (response.data.results) {
//             const filteredMedications = utils.mapMedicationData(response.data);
//             res.json(filteredMedications);
//         } else {
//             res.json([]);
//         }
//     } catch (error) {
//         res.status(404).json([]);
//     }
// }

/**
 * Retrieves medication data from FDA API based on the provided ID.
 *
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @return {Promise<void>} - The async function returns nothing directly, but
 *                           modifies the response object.
 */
// const get_medication = async (req, res) => {
//     const id = req.params.id;
//     const query = `search=(id:"${id}")`;
//     const url = `${constants.FDABaseUrl}?${query}&limit=1`;

//     try {
//         const response = await axios.get(url);
//         if (response.data.results) {
//             const filteredMedications = utils.mapMedicationData(response.data);
//             res.json(filteredMedications[0]);
//         } else {
//             res.json({});
//         }
//     } catch (error) {
//         res.status(404).send({ message: 'No medication found', code: error.code });
//     }
// }

/**
 * Function to handle the process of posting medication data.
 *
 * @async
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise} A promise that resolves when the medication data is successfully posted.
 */
const post_medication = async (req, res) => {
    const cabinet_id = req.body.cabinet_id;
    const t = await sequelize.transaction();

    try {
        if (cabinet_id === undefined) {
            throw Error;
        }
        const medications = req.body.medications;
        for (const med of medications) {
            await createMedication(med.medication_id);
            await CabinetBox.upsert({
                cabinet_id: cabinet_id,
                medication_id: med.medication_id,
                box: med.box,
                quantity: med.quantity
            });
        }
        await t.commit();
        res.status(200).send({ message: 'Medication received successfully.' });
    } catch (err) {
        await t.rollback();
        console.error(err);
        res.status(400).send({ message: 'Bad Request' });
    }
}

/**
 * Create medication schedules for a patient.
 * @async
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {void}
 */
const post_schedule = async (req, res) => {
    const cabinet_id = req.body.cabinet_id;
    const patient_id = req.body.patient_id;
    const t = await sequelize.transaction();

    try {
        if (patient_id === undefined || cabinet_id === undefined) {
            throw Error;
        }
        const medication_schedules = req.body.medications;

        for (const schedule of medication_schedules) {
            await Schedule.create({
                patient_id: patient_id,
                medication_id: schedule.medication_id,
                day: schedule.day,
                time: schedule.time,
            });
        }
        await t.commit();
        res.status(200).send({ message: 'Schedule received successfully.' });
    } catch (err) {
        await t.rollback();
        console.error(err);
        res.status(400).send({ message: 'Bad Request' });
    }
}

/**
 * Creates a session and session intakes for the given request and response objects.
 *
 * @async
 * @param {Object} req - The request object contains the cabinet ID, patient ID, and session intakes.
 * @param {Object} res - The response object used to send the session status.
 * @returns {Promise<void>} - A Promise that resolves when the session is created and committed successfully, otherwise rejects with an error.
 */
const post_session = async (req, res) => {
    const cabinet_id = req.body.cabinet_id;
    const patient_id = req.body.patient_id;
    const t = await sequelize.transaction();

    try {
        if (patient_id === undefined || cabinet_id === undefined) {
            throw Error;
        }
        const session_intakes = req.body.session_intakes;
        const session = await Session.create(req.body, { transaction: t });

        for (const intake of session_intakes) {

            await SessionIntake.create({
                medication_id: intake.medication_id,
                start_time: intake.start_time,
                ingest_time: intake.ingest_time,
                end_time: intake.end_time,
                ingested: intake.ingested,
                session_id: session.id
            }, { transaction: t });

        }
        await t.commit();
        res.status(200).send({ message: 'Session received successfully.' });

    } catch (err) {
        await t.rollback();
        console.error(err);
        res.status(400).send({ message: 'Bad Request' });
    }
}

const getIngestionChartData = async (req, res) => {
    const session_intakes = await SessionIntake.findAll();
    var dict_session_intakes = {};
    session_intakes.map(intake => {
        if (dict_session_intakes[intake.medication_id] === undefined) {
            dict_session_intakes[intake.medication_id] = [(intake.end_time - intake.start_time) / 1000, 1];
        } else {
            dict_session_intakes[intake.medication_id][0] += (intake.end_time - intake.start_time) / 1000;
            dict_session_intakes[intake.medication_id][1] += 1;
        }
    })
    var final_array = [];
    for (let key in dict_session_intakes) {
        const medication = await getMedicationById(key);
        final_array.push(
            {
                name: medication.brand_name,
                y: dict_session_intakes[key][0] / dict_session_intakes[key][1]
            }
        )
    }
    return final_array;
}

const getPreprocessedScheduleData = (scheduleDetails) => {
    var dayWiseSchedule = {
        0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    };
    for (const schedule of scheduleDetails) {
        dayWiseSchedule[schedule.day].push(schedule);
    }
    return dayWiseSchedule;
}

const getSessionDetails = async (patientId) => {
    const sessions = await Session.findAll({
        where: { patient_id: patientId },
    })
    var dict_session_details = {}
    sessions.map(session => {
        if (dict_session_details[session.id] === undefined) {
            dict_session_details[session.id] = (session.end_time - session.start_time) / 1000;
        }
    });

    var final_dict = {};
    const session_intakes = await SessionIntake.findAll();
    for (let key in dict_session_details) {
        const res = session_intakes.filter(intake => intake.session_id === key);
        if (final_dict[res[0].medication_id] === undefined) {
            final_dict[res[0].medication_id] = [dict_session_details[key], 1];
        } else {
            final_dict[res[0].medication_id][0] += dict_session_details[key];
            final_dict[res[0].medication_id][1] += 1;
        }
    }
    var final_array = [];
    for (let key in final_dict) {
        const medicationDetails = await getMedicationById(key);
        final_array.push(
            {
                name: medicationDetails.brand_name,
                y: final_dict[key][0] / final_dict[key][1]
            }
        )
    }
    return final_array;
}

const getIngestionFalureData = async () => {
    const session_intakes = await SessionIntake.findAll();
    var dict_failure_calculation = {};
    session_intakes.map(intake => {
        if (dict_failure_calculation[intake.medication_id] === undefined) {
            if (intake.ingested)
                dict_failure_calculation[intake.medication_id] = { ingested: 1, notIngested: 0, total: 1 };
            else
                dict_failure_calculation[intake.medication_id] = { ingested: 0, notIngested: 1, total: 1 }
        } else {
            if (intake.ingested)
                dict_failure_calculation[intake.medication_id].ingested += 1;
            else
                dict_failure_calculation[intake.medication_id].notIngested += 1;
            dict_failure_calculation[intake.medication_id].total += 1;
        }
    })
    var final_array = [];
    for (let key in dict_failure_calculation) {
        const medicationDetails = await getMedicationById(key);
        final_array.push(
            {
                name: medicationDetails.brand_name,
                y: dict_failure_calculation[key].notIngested === 0 ? 0 : (dict_failure_calculation[key].notIngested / dict_failure_calculation[key].total) * 100
            }
        )
    }
    return final_array;
}
/**
 * Renders the patient page with patient information and caretaker options.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {undefined}
 */

const patient = async (req, res) => {
    if (req.session.user) {
        try {
            const patientDetails = await getPatient(req.query.id);
            const caretakerDetails = await getCaretaker(patientDetails.caretaker_id);
            const medicationDetails = await getMedicationsWithDetails(patientDetails.id); // Function to get medications with details like NDC, box, etc.
            const scheduleDetails = await getMedicationSchedules(patientDetails.id); // Function to get medication schedules
            const ingestionChartData = await getIngestionChartData(patientDetails.id);
            const sessionDetails = await getSessionDetails(patientDetails.id);
            const ingestionFailureData = await getIngestionFalureData();
            // const dict_session_details = calculate_response_times(sessionDetails,)
            // const preProcessSheduleData = getPreprocessedScheduleData(scheduleDetails);
            return res.render('patient', {
                patient: patientDetails,
                careTaker: caretakerDetails,
                medicationData: medicationDetails,
                schedules: scheduleDetails,//JSON.stringify(preProcessSheduleData),
                sessionDetails: JSON.stringify(sessionDetails),
                ingestionChartData: JSON.stringify(ingestionChartData),
                ingestionFailureData: JSON.stringify(ingestionFailureData)
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Error retrieving patient information');
        }
    } else {
        res.redirect('/login');
    }
};

/**
 * Retrieves medication by ID from FDA API.
 *
 * @param {string} id - The ID of the medication to fetch.
 * @returns {Object|null} - The medication object if found, or null if not found.
 * @throws {Error} - If an error occurs while fetching the medication.
 */
const getMedicationById = async (id) => {
    const query = `search=(id:"${id}")`;
    const url = `${constants.FDABaseUrl}?${query}&limit=1`;

    try {
        const response = await axios.get(url);
        if (response.data.results) {
            const filteredMedications = utils.mapMedicationData(response.data);
            return filteredMedications[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching medication:", error);
    }
}


/**
 * Retrieves all patients along with their associated caretaker information.
 *
 * @async
 * @function getAllPatients
 * @returns {Promise<Array<object>>} - Array of patient objects
 *
 * @throws {Error} if there is any error encountered while fetching patients for caretaker
 */
const getAllPatients = async () => {
    try {
        const patients = await Patient.findAll({
            include: [{
                model: Caretaker, attributes: ['first_name', 'last_name']
            }]
        });

        return patients.map(patient => {
            const patientJson = patient.toJSON();
            return {
                ...patientJson,
                caretaker_first_name: patientJson.Caretaker.first_name,
                caretaker_last_name: patientJson.Caretaker.last_name,
                Caretaker: undefined
            };
        });

    } catch (err) {
        console.error('Error fetching patients for caretaker:', err);
        throw err;
    }
}

/**
 * Retrieves a patient with the specified ID from the database.
 *
 * @async
 * @param {string} id - The ID of the patient to retrieve.
 * @returns {Promise<Object|null>} - A promise that resolves with the patient object if found, or null if not found.
 * @throws {Error} - If there was an error fetching the patient.
 */
const getPatient = async (id) => {
    try {

        if (typeof id !== 'string') {
            console.error('Error fetching patient: Invalid ID type');
            return null;
        }

        const patient = await Patient.findOne({
            where: { id }
        });
        return patient ? patient.toJSON() : null;
    } catch (err) {
        console.error('Error fetching patient', err);
        throw err;
    }
};


/**
 * Fetches all caretakers from the database.
 *
 * @returns {Promise} A promise that resolves to an array of caretaker objects.
 * @throws {Error} If there is an error fetching caretakers from the database.
 */
const getAllCaretakers = async () => {
    try {
        const caretakers = await Caretaker.findAll();
        return caretakers.map(caretaker => caretaker.toJSON());
    } catch (err) {
        console.error('Error fetching caretakers', err);
        throw err;
    }
};


const getMedicationSchedules = async (patientId) => {
    try {
        if (typeof patientId !== 'string') {
            console.error('Error fetching medication schedules: Invalid patient ID type');
            return [];
        }

        const schedules = await Schedule.findAll({
            where: { patient_id: patientId },
            include: [
                {
                    model: Medication
                },
                {
                    model: SessionIntake
                },
            ]
        });
        return schedules.map(schedule => schedule.toJSON());
    } catch (err) {
        console.error('Error fetching medication schedules', err);
        throw err;
    }
};



const getMedicationsWithDetails = async (patientId) => {
    try {
        if (typeof patientId !== 'string') {
            console.error('Error fetching medications: Invalid patient ID type');
            return [];
        }

        // Assuming Medication has a foreign key relationship with NDC and CabinetBox
        const medications = await Medication.findAll({
            include: [
                {
                    model: NDC,
                    attributes: ['code']
                },
                {
                    model: CabinetBox,
                    attributes: ['box', 'quantity']
                },
            ]
        });

        return medications.map(medication => {
            const medicationJSON = medication.toJSON();
            return {
                ...medicationJSON,
                ndc: medicationJSON.NDCs?.[0]?.code, // Get NDC code
                box: medicationJSON.CabinetBoxes?.[0]?.box, // Get box information
                quantity: medicationJSON.CabinetBoxes?.[0]?.quantity, // Get quantity

            };
        });
    } catch (err) {
        console.error('Error fetching medications with details', err);
        throw err;
    }
};


const getPatientProfile = async (req, res) => {
    const patientId = req.query.id;
    try {
        const patientDetails = await getPatientDetailsWithSchedules(patientId);
        res.render('patient', {
            patient: patientDetails.patient,
            careTaker: patientDetails.caretaker,
            medicationData: patientDetails.medications,
            schedules: patientDetails.schedules
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving patient profile');
    }
};


/**
 * Fetches a caretaker by id.
 *
 * @param {number} id - The id of the caretaker.
 * @returns {Promise<Object|null>} - A promise that resolves to the caretaker object
 *                                   if found, otherwise null.
 * @throws {Error} - If there was an error fetching the caretaker.
 */
const getCaretaker = async (id) => {
    try {
        if (typeof id !== 'string') {
            console.error('Error fetching caretaker: Invalid ID type');
            return null;
        }

        const caretaker = await Caretaker.findOne({
            where: { id },
            attributes: ['id', 'first_name', 'last_name', 'email']
        });
        return caretaker ? caretaker.toJSON() : null;
    } catch (err) {
        console.error('Error fetching caretaker', err);
        throw err;
    }
};

module.exports = {
    profile,
    patient,
    getAllPatients
}