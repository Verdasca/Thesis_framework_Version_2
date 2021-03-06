var Project = require('../models/project');
var mongoose = require( 'mongoose' );
var User = mongoose.model('User');
var Parameter = require('../models/parameter');
var Alternative = require('../models/alternative');
var Criterion = require('../models/criterion');
var Category = require('../models/category');
var Performance = require('../models/performanceTable');
var Profile = require('../models/profileTable');
var Person = require('../models/person');
var fs = require('fs-extra')

//Create a project
module.exports.create = function (req, res) {
	var project = new Project(req.body);
	project.save(function (err, result) {
	    //res.json(result);
	});

    // Associate/save the new project to the user
    User.findOne({ _id:req.params.id })
        .populate('projects')
        .exec(function (err, user) {
        if (err){
          res.send(err);
        }
        // First push then save to do the association
        user.projects.push(project);
        user.save();
        res.send('Create project complete.');
    });
}

//Get all projects of the user
module.exports.get = function (req, res) {
    // // use mongoose to get all projects in the database
    // Project.find(function(err, projects) {
    //     // if there is an error retrieving, send the error. nothing after res.send(err) will execute
    //     if (err){
    //         res.send(err);    
    //     }
    //     res.json(projects); // return all projects in JSON format
    // });

    User
        .findOne({ _id: req.params.id })
        .populate('projects') // only works if we pushed refs to children
        .exec(function (err, user) {
          if (err){
            res.send(err);
          }
          //console.log(user);
          res.json(user);
    });
}

module.exports.findById = function (req, res) {  
    return Project.findById(req.params.id, function (err, project) {
      if (!err) {
            res.jsonp(project);
      } else {
            console.log(err);
            res.send(err);
      }
    });
}

//Edit a project
module.exports.edit = function (req, res) {
    Project.findOneAndUpdate({
            _id:req.params.id
        },
        {$set:{ name:req.body.name, dateSet:req.body.dateSet, methodChosen:req.body.methodChosen, notes:req.body.notes, numExecutions:req.body.numExecutions, orderType:req.body.orderType, orderAttribute:req.body.orderAttribute, decimals:req.body.decimals, ratioOption:req.body.ratioOption, ratioZ:req.body.ratioZ, ratioZMax:req.body.ratioZMax, ratioZMin:req.body.ratioZMin, ratioZInterval:req.body.ratioZInterval, ratioZ1:req.body.ratioZ1, ratioZ2:req.body.ratioZ2, ratioZ3:req.body.ratioZ3 }},
        {upsert:true},
        function(err,project){
            if(err){
                console.log('error occured');
                res.send(err);
            }else{
                //console.log(project);
                res.send(project);
            }       
    });
}

module.exports.editResults = function (req, res) {
    var projectID = req.params.projectId;
    var resultID = req.params.id;
    var newName = req.body.name;
    var notes = req.body.notes;
    Project.findOneAndUpdate( 
        { '_id': projectID, 'results.identifier': resultID },
        { $set: {'results.$.name': newName,  'results.$.resultNotes': notes} },
        {upsert:true},
        function(err,project){
            if(err){
                console.log('error occured');
                res.send(err);
            }else{
                //console.log(project);
                res.send(project);
            }    
    });
}

//Add new result into the project
module.exports.addResult = function (req, res) {
    console.log('Adding results...');
    var projectID = req.params.projectId;
    //console.log('ProId: '+projectID+' obj: '+req.body.resName);
    //console.log(req.body);
    var id = req.body.id;
    var n = req.body.resName;
    var date = req.body.date;
    var type = req.body.orderTypes;
    var attribute = req.body.orderAttributes;
    var notes = req.body.resultNotes;
    Project.findOneAndUpdate( 
        { '_id': projectID },
        { $push: { results: {identifier : id, name: n, resultDate: date, orderTypes: type, orderAttributes: attribute, resultNotes: notes} } },
        {safe: true, upsert: true, new : true},
        function(err, result) {
            if(err){
                res.send(err);
            }else{
                res.send('Result added.');
            }
    });
}

//Update new result
module.exports.saveResult = function (req, res) {
    console.log('Saving result...');
    var projectID = req.params.projectId;
    var resultID = req.params.id;
    var name = req.body.name;
    var age = req.body.age;
    Project.findOneAndUpdate( 
        { '_id': projectID, 'results.identifier': resultID },
        { $push: {'results.$.personValues': {personName : name, personAge: age} } },
        //{safe: true},
        function(err, result) {
            if(err){
                res.send(err);
            }
            res.send('Result updated.');
    });
}

//Delete a result from the project
module.exports.deleteResult = function (req, res) {
    console.log('Deleting result...');
    var projectID = req.params.projectId;
    var resultID = req.params.id;
    //console.log('Project: '+projectID +' ResultId: '+resultID);
    Project.update( 
      { '_id': projectID },
      { $pull: { results : {identifier : resultID} } },
      { safe: true },
      function removeConnectionsCB(err, obj) {
            if(err){
                res.send(err);
            }
            res.send('Delete result complete.');
      });
}

//Reload the data from the result into the current data of the project - for methods based on local files and not DB (update configurations)
module.exports.reloadProjectFileMethods = function (req, res) {
    console.log('Reloading...');
    var projectID = req.params.projectId;
    var resultID = req.params.id;
    var resultData = req.body;
    var order = resultData.orderTypes;
    var attribute = resultData.orderAttributes;
    //Reload configurations
    Project.update({ _id: projectID}, { orderType: order, orderAttribute: attribute},function(err){
        if(err){
            console.log(err);
        }else{
            console.log("Successfully reloaded configurations.");
        }
    });

    res.send('Data reloaded.');
}

//Reload the data from the result into the current data of the project - for electre tri-c method
module.exports.reloadProject = function (req, res) {
    console.log('Reloading result...');
    var projectID = req.params.projectId;
    var resultID = req.params.id;
    var resultData = req.body;

    var alternative = resultData.alternativeValues;
    var alts = [];
    //var alt = {name: "",description: ""};
    for (var i = 0; i < alternative.length; i++) {
        //alt.name = alternative[i].alternativeName;
        //alt.description = alternative[i].alternativeDescription;
        //var newalt = new Alternative(alt);
        var newalt = new Alternative(alternative[i]);
        newalt.save(function (err, result) {
            //res.json(result);
        });
        alts.push(newalt);
    }
    Project.update({ _id: projectID}, {'$pushAll': {alternatives: alts}},{upsert:true},function(err){
        if(err){
            console.log(err);
        }else{
            console.log("Successfully reloaded alternatives.");
        }
    });

    var criterion = resultData.criterionValues;
    var cris = [];
    for (var i = 0; i < criterion.length; i++) {
        var newcri = new Criterion(criterion[i]);
        newcri.save(function (err, result) {
            //res.json(result);
        });
        cris.push(newcri);
    }
    Project.update({ _id: projectID}, {'$pushAll': {criteria: cris}},{upsert:true},function(err){
        if(err){
            console.log(err);
        }else{
            console.log("Successfully reloaded criteria.");
        }
    });

    var parameter = resultData.parameterValues;
    var pars = [];
    for (var i = 0; i < parameter.length; i++) {
        var newpar = new Parameter(parameter[i]);
        newpar.save(function (err, result) {
            //res.json(result);
        });
        pars.push(newpar);
    }
    Project.update({ _id: projectID}, {'$pushAll': {parameters: pars}},{upsert:true},function(err){
        if(err){
            console.log(err);
        }else{
            console.log("Successfully reloaded parameters.");
        }
    });

    var category = resultData.categoryValues;
    var cats = [];
    for (var i = 0; i < category.length; i++) {
        var newcat = new Category(category[i]);
        newcat.save(function (err, result) {
            //res.json(result);
        });
        cats.push(newcat);
    }
    Project.update({ _id: projectID}, {'$pushAll': {categories: cats}},{upsert:true},function(err){
        if(err){
            console.log(err);
        }else{
            console.log("Successfully reloaded categories.");
        }
    });

    var performance = resultData.performanceValues;
    var perfs = [];
    for (var i = 0; i < performance.length; i++) {
        var newperf = new Performance(performance[i]);
        newperf.save(function (err, result) {
            //res.json(result);
        });
        perfs.push(newperf);
    }
    Project.update({ _id: projectID}, {'$pushAll': {performancetables: perfs}},{upsert:true},function(err){
        if(err){
            console.log(err);
        }else{
            console.log("Successfully reloaded performances.");
        }
    });

    var profile = resultData.profileValues;
    var pros = [];
    for (var i = 0; i < profile.length; i++) {
        var newpro = new Profile(profile[i]);
        newpro.save(function (err, result) {
            //res.json(result);
        });
        pros.push(newpro);
    }
    Project.update({ _id: projectID}, {'$pushAll': {profiletables: pros}},{upsert:true},function(err){
        if(err){
            console.log(err);
        }else{
            console.log("Successfully reloaded profiles.");
        }
    });

    res.send('Data reloaded.');
}

//Reload the data from the result into the current data of the project - for order people method
module.exports.reloadProjectOrderPeople = function (req, res) {
    console.log('Reloading result...');
    var projectID = req.params.projectId;
    var resultID = req.params.id;
    var resultData = req.body;
    var order = resultData.orderTypes;
    var attribute = resultData.orderAttributes;
    //Reload configurations
    Project.update({ _id: projectID}, { orderType: order, orderAttribute: attribute},function(err){
        if(err){
            console.log(err);
        }else{
            console.log("Successfully reloaded configurations.");
        }
    });

    var person = resultData.personValues;
    var pers = [];
    var per = {name:"", age:0};
    for (var i = 0; i < person.length; i++) {
        per.name = person[i].personName;
        per.age = person[i].personAge;
        var newper = new Person(per);
        newper.save(function (err, result) {
            //res.json(result);
        });
        pers.push(newper);
    }
    Project.update({ _id: projectID}, {'$pushAll': {people: pers}},{upsert:true},function(err){
        if(err){
            console.log(err);
        }else{
            console.log("Successfully reloaded people.");
        }
    });

    res.send('Data reloaded.');
}

//Delete a project + delete the associated data from other collections
module.exports.delete = function(req, res){
    var project = req.params.projectId;
    // Before deleting the project, all the data associated with the project must be deleted as well
    //Delete all associated parameters
    Project.findOne({ _id: project })
        .populate('parameters')
        .exec(function (err, project) {
            if (err){
                //res.send(err);
            }
            var parameter = project.parameters;
            if(parameter.length == 0 || parameter == ''){
                //Do nothing
            }else{
                Project.update({ _id: project }, {'$pullAll': {parameters: parameter }})
                  .exec(function(err) {
                    Parameter.remove({ _id: { $in: parameter }}, function(err, numberRemoved) {
                      // The identified parameter are now removed.
                    });
                });
            }
    });
    //Delete all associated alternatives
    Project.findOne({ _id: project })
        .populate('alternatives')
        .exec(function (err, project) {
            if (err){
                //res.send(err);
            }
            var alternative = project.alternatives;
            if(alternative.length == 0 || alternative == ''){
                //Do nothing
            }else{
                Project.update({ _id: project }, {'$pullAll': {alternatives: alternative }})
                  .exec(function(err) {
                    Alternative.remove({ _id: { $in: alternative }}, function(err, numberRemoved) {
                      // The identified alternative are now removed.
                    });
                });
            }
    });
    //Delete all associated criteria
    Project.findOne({ _id: project })
        .populate('criteria')
        .exec(function (err, project) {
            if (err){
                //res.send(err);
            }
            var criterion = project.criteria;
            if(criterion.length == 0 || criterion == ''){
                //Do nothing
            }else{
                Project.update({ _id: project }, {'$pullAll': {criteria: criterion }})
                  .exec(function(err) {
                    Criterion.remove({ _id: { $in: criterion }}, function(err, numberRemoved) {
                      // The identified criterion are now removed.
                    });
                }); 
            }   
    });
    //Delete all associated categories
    Project.findOne({ _id: project })
        .populate('categories')
        .exec(function (err, project) {
            if (err){
                //res.send(err);
            }
            var category = project.categories;
            if(category.length == 0 || category == ''){
                //Do nothing
            }else{
                Project.update({ _id: project }, {'$pullAll': {categories: category }})
                  .exec(function(err) {
                    Category.remove({ _id: { $in: category }}, function(err, numberRemoved) {
                      // The identified category are now removed.
                    });
                });    
            }
    });
    //Delete all associated performances
    Project.findOne({ _id: project })
        .populate('performancetables')
        .exec(function (err, project) {
            if (err){
                //res.send(err);
            }
            var performance = project.performancetables;
            if(performance.length == 0 || performance == ''){
                //Do nothing
            }else{
                Project.update({ _id: project }, {'$pullAll': {performancetables: performance }})
                  .exec(function(err) {
                    Performance.remove({ _id: { $in: performance }}, function(err, numberRemoved) {
                      // The identified performance are now removed.
                    });
                });  
            }
    });
    //Delete all associated profiles
    Project.findOne({ _id: project })
        .populate('profiletables')
        .exec(function (err, project) {
            if (err){
                //res.send(err);
            }
            var profile = project.profiletables;
            if(profile.length == 0 || profile == ''){
                //Do nothing
            }else{
                Project.update({ _id: project }, {'$pullAll': {profiletables: profile }})
                  .exec(function(err) {
                    Profile.remove({ _id: { $in: profile }}, function(err, numberRemoved) {
                      // The identified profile are now removed.
                    });
                });    
            }
    });
    //Delete all associated people
    Project.findOne({ _id: project })
        .populate('people')
        .exec(function (err, project) {
            if (err){
                //res.send(err);
            }
            var person = project.people;
            if(person.length == 0 || person == ''){
                //Do nothing
            }else{
                Project.update({ _id: project }, {'$pullAll': {people: person }})
                  .exec(function(err) {
                    Person.remove({ _id: { $in: person }}, function(err, numberRemoved) {
                      // The identified person are now removed.
                    });
                });   
            }
    });
    //console.log('ID user: '+req.params.id+' id project: '+req.params.projectId);
    User.update({ '_id' :req.params.id }, {$pull: { projects: project }} )
      .exec(function(err) {
        Project.remove({ '_id' : project }, function(err, numberRemoved) {
            // The identified project is now removed.
        });
    });

    res.send('Delete project plus respective parameters complete.');

}

//Duplicate a project
module.exports.duplicate = function(req, res){
    var projectID = req.params.projectId;

    Project.findOne({ _id: projectID })
        .exec(function (err, project) {
            if (err){
                res.send(err);
            }
            project._id = mongoose.Types.ObjectId();
            var newId = project._id;
            console.log(newId);
            project.isNew = true;
            project.name = project.name + '_2';
            project.creationDate = new Date();
            project.dateSet = new Date();
            project.numExecutions = 0;
            project.alternatives = [];
            project.criteria = [];
            project.categories = [];
            project.parameters = [];
            project.performancetables = [];
            project.profiletables = [];
            project.people = [];
            project.results = []; 
            project.save(function (err, result) {
                //res.json(result);
            });
            // Save alternatives with a new id and associate the new id to the clone project
            Project.findOne({ _id: projectID })
                .populate('alternatives')
                .exec(function (err, project) {
                    if (err){
                        //res.send(err);
                    }
                    var alternative = project.alternatives;
                    var alts = [];
                    var alt = {
                        name: "",
                        description: ""
                    };
                    for (var i = 0; i < alternative.length; i++) {
                        alt.name = alternative[i].name;
                        alt.description = alternative[i].description;
                        var newalt = new Alternative(alt);
                        newalt.save(function (err, result) {
                                //res.json(result);
                        });
                        alts.push(newalt);
                    }
                    Project.update({ _id: newId}, {'$pushAll': {alternatives: alts}},{upsert:true},function(err){
                        if(err){
                            console.log(err);
                        }else{
                            console.log("Successfully clone alternatives.");
                        }
                    });
            });
            // Save criteria with a new id and associate the new id to the clone project
            Project.findOne({ _id: projectID })
                .populate('criteria')
                .exec(function (err, project) {
                    if (err){
                        //res.send(err);
                    }
                    var criterion = project.criteria;
                    var cris = [];
                    var cri = { name: "", description: "", direction: "", measure: "", weight: 0, rank: 0, indifference: 0, name: 0, name: 0};
                    for (var i = 0; i < criterion.length; i++) {
                        cri.name = criterion[i].name;
                        cri.description = criterion[i].description;
                        cri.direction = criterion[i].direction;
                        cri.measure = criterion[i].measure;
                        cri.weight = criterion[i].weight;
                        cri.rank = criterion[i].rank;
                        cri.indifference = criterion[i].indifference;
                        cri.preference = criterion[i].preference;
                        cri.veto = criterion[i].veto;
                        var newcri = new Criterion(cri);
                        newcri.save(function (err, result) {
                                //res.json(result);
                        });
                        cris.push(newcri);
                    }
                    Project.update({ _id: newId}, {'$pushAll': {criteria: cris}},{upsert:true},function(err){
                        if(err){
                            console.log(err);
                        }else{
                            console.log("Successfully clone criteria.");
                        }
                    });
            });
            // Save parameters with a new id and associate the new id to the clone project
            Project.findOne({ _id: projectID })
                .populate('parameters')
                .exec(function (err, project) {
                    if (err){
                        //res.send(err);
                    }
                    var parameter = project.parameters;
                    var pars = [];
                    var par = { credibility: 0 };
                    for (var i = 0; i < parameter.length; i++) {
                        par.credibility = parameter[i].credibility;
                        var newpar = new Parameter(par);
                        newpar.save(function (err, result) {
                                //res.json(result);
                        });
                        pars.push(newpar);
                    }
                    Project.update({ _id: newId}, {'$pushAll': {parameters: pars}},{upsert:true},function(err){
                        if(err){
                            console.log(err);
                        }else{
                            console.log("Successfully clone parameters.");
                        }
                    });
            });
            // Save categories with a new id and associate the new id to the clone project
            Project.findOne({ _id: projectID })
                .populate('categories')
                .exec(function (err, project) {
                    if (err){
                        //res.send(err);
                    }
                    var category = project.categories;
                    var cats = [];
                    var cat = { name: "", rank: 0, action: "" };
                    for (var i = 0; i < category.length; i++) {
                        cat.name = category[i].name;
                        cat.rank = category[i].rank;
                        cat.action = category[i].action;
                        var newcat = new Category(cat);
                        newcat.save(function (err, result) {
                                //res.json(result);
                        });
                        cats.push(newcat);
                    }
                    Project.update({ _id: newId}, {'$pushAll': {categories: cats}},{upsert:true},function(err){
                        if(err){
                            console.log(err);
                        }else{
                            console.log("Successfully clone categories.");
                        }
                    });
            });
            // Save performances with a new id and associate the new id to the clone project
            Project.findOne({ _id: projectID })
                .populate('performancetables')
                .exec(function (err, project) {
                    if (err){
                        //res.send(err);
                    }
                    var performance = project.performancetables;
                    var perfs = [];
                    var perf = { alternative: "", criterion: "", value: 0 };
                    for (var i = 0; i < performance.length; i++) {
                        perf.alternative = performance[i].alternative;
                        perf.criterion = performance[i].criterion;
                        perf.value = performance[i].value;
                        var newperf = new Performance(perf);
                        newperf.save(function (err, result) {
                                //res.json(result);
                        });
                        perfs.push(newperf);
                    }
                    Project.update({ _id: newId}, {'$pushAll': {performancetables: perfs}},{upsert:true},function(err){
                        if(err){
                            console.log(err);
                        }else{
                            console.log("Successfully clone performances.");
                        }
                    });
            });
            // Save profiles with a new id and associate the new id to the clone project
            Project.findOne({ _id: projectID })
                .populate('profiletables')
                .exec(function (err, project) {
                    if (err){
                        //res.send(err);
                    }
                    var profile = project.profiletables;
                    var pros = [];
                    var pro = { action: "", criterion: "", value: 0 };
                    for (var i = 0; i < profile.length; i++) {
                        pro.action = profile[i].action;
                        pro.criterion = profile[i].criterion;
                        pro.value = profile[i].value;
                        var newpro = new Profile(pro);
                        newpro.save(function (err, result) {
                                //res.json(result);
                        });
                        pros.push(newpro);
                    }
                    Project.update({ _id: newId}, {'$pushAll': {profiletables: pros}},{upsert:true},function(err){
                        if(err){
                            console.log(err);
                        }else{
                            console.log("Successfully clone profiles.");
                        }
                    });
            });
            // Save people with a new id and associate the new id to the clone project
            Project.findOne({ _id: projectID })
                .populate('people')
                .exec(function (err, project) {
                    if (err){
                        //res.send(err);
                    }
                    var person = project.people;
                    var pers = [];
                    var per = {
                        name: "",
                        age: 0
                    };
                    for (var i = 0; i < person.length; i++) {
                        per.name = person[i].name;
                        per.age = person[i].age;
                        var newper = new Person(per);
                        newper.save(function (err, result) {
                                //res.json(result);
                        });
                        pers.push(newper);
                    }
                    Project.update({ _id: newId}, {'$pushAll': {people: pers}},{upsert:true},function(err){
                        if(err){
                            console.log(err);
                        }else{
                            console.log("Successfully clone people.");
                        }
                    });
            });
            // Associate/save the new project to the user
            User.findOne({ _id:req.params.id })
                .populate('projects')
                .exec(function (err, user) {
                if (err){
                  res.send(err);
                }
                // First push then save to do the association
                if(project.methodChosen == 'Order By'){
                    var dir = './Projects/' + projectID + '/data';
                    var cloneDir = './Projects/' + project._id;
                    // If folder does not exist, create the folder plus data and result folder
                    if (!fs.existsSync(cloneDir)){
                        fs.mkdirSync(cloneDir);
                        fs.mkdirSync(cloneDir+'/data');
                        fs.mkdirSync(cloneDir+'/results');
                    }
                    var cloneDirData = cloneDir + '/data';
                    fs.copy(dir, cloneDirData, function (err) {
                      if (err) {
                        console.error(err);
                      } else {
                        console.log("success!");
                      }
                    }); //copies directory, even if it has subdirectories or files
                }else{
                    //Do nothing - method does not use local files
                }
                user.projects.push(project);
                user.save();
                //res.send('Clone project complete.');
                res.send('Cloning project plus respective parameters complete.');
            });
    });
}